import { ConnectorAccount, ConnectorType, User } from "@prisma/client";

import { prisma } from "@/lib/db";
import { stringifyJson, parseJson } from "@/lib/json";
import { inferSignalsFromTerms } from "@/lib/intelligence";
import { parseCsv, truncate, uniqueStrings } from "@/lib/utils";

type ConnectorRecord = ConnectorAccount & {
  user: User;
};

type RepoResponse = {
  full_name: string;
  name: string;
  description: string | null;
  topics?: string[];
  updated_at: string;
  stargazers_count: number;
  html_url: string;
};

type GithubContentResponse = {
  content?: string;
  encoding?: string;
};

const GITHUB_MANIFESTS = [
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "Cargo.toml",
  "go.mod",
  "pom.xml",
];

function githubHeaders(token?: string) {
  return {
    Accept: "application/vnd.github+json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "User-Agent": "AI-Trend-Intel-MVP",
  };
}

async function fetchGithubJson<T>(url: string, token?: string) {
  const response = await fetch(url, {
    headers: githubHeaders(token),
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`GitHub request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

async function fetchGithubManifest(
  repoFullName: string,
  path: string,
  token?: string,
) {
  const response = await fetch(
    `https://api.github.com/repos/${repoFullName}/contents/${path}`,
    {
      headers: githubHeaders(token),
      next: { revalidate: 0 },
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as GithubContentResponse;
  if (payload.encoding !== "base64" || !payload.content) {
    return null;
  }

  return Buffer.from(payload.content, "base64").toString("utf8");
}

function extractDependencyNames(path: string, content: string) {
  const dependencies = new Set<string>();

  if (path === "package.json") {
    try {
      const parsed = JSON.parse(content) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

      Object.keys(parsed.dependencies ?? {}).forEach((dependency) =>
        dependencies.add(dependency),
      );
      Object.keys(parsed.devDependencies ?? {}).forEach((dependency) =>
        dependencies.add(dependency),
      );
    } catch {
      return [];
    }
  } else if (path === "requirements.txt") {
    content.split("\n").forEach((line) => {
      const match = line.match(/^([a-zA-Z0-9_.-]+)/);
      if (match?.[1]) {
        dependencies.add(match[1]);
      }
    });
  } else if (path === "pyproject.toml") {
    Array.from(content.matchAll(/([a-zA-Z0-9_.-]+)\s*(?:=|>=|<=|~=)/g)).forEach(
      (match) => {
        if (match[1] && !["name", "version", "description", "python"].includes(match[1])) {
          dependencies.add(match[1]);
        }
      },
    );
  } else if (path === "Cargo.toml") {
    Array.from(content.matchAll(/^([a-zA-Z0-9_-]+)\s*=/gm)).forEach((match) => {
      if (match[1] && match[1] !== "package") {
        dependencies.add(match[1]);
      }
    });
  } else if (path === "go.mod") {
    Array.from(content.matchAll(/^\s*([a-zA-Z0-9./_-]+)\s+v/gm)).forEach((match) => {
      if (match[1]) {
        dependencies.add(match[1].split("/").pop() ?? match[1]);
      }
    });
  } else if (path === "pom.xml") {
    Array.from(content.matchAll(/<artifactId>([^<]+)<\/artifactId>/g)).forEach((match) => {
      if (match[1]) {
        dependencies.add(match[1]);
      }
    });
  }

  return Array.from(dependencies);
}

function summarizeSignals(labels: string[]) {
  if (!labels.length) {
    return "No strong developer signals were inferred yet.";
  }

  return `Current work is leaning toward ${labels.slice(0, 5).join(", ")}.`;
}

async function recordTelemetrySnapshot(
  userId: string,
  connectorType: ConnectorType,
  sourceLabel: string,
  summary: string,
  signals: ReturnType<typeof inferSignalsFromTerms>,
) {
  await prisma.telemetrySnapshot.create({
    data: {
      userId,
      connectorType,
      sourceLabel,
      summary,
      signalCount: signals.length,
      dataJson: stringifyJson({
        signals,
      }),
    },
  });
}

async function syncGithubConnector(connector: ConnectorRecord) {
  const config = parseJson<{ watchedRepos?: string[] }>(connector.configJson, {});
  const token = connector.accessToken ?? undefined;
  const username = connector.accountKey ?? "";
  const repoNames = new Set<string>(config.watchedRepos ?? []);

  if (username) {
    try {
      const repos = await fetchGithubJson<RepoResponse[]>(
        `https://api.github.com/users/${username}/repos?sort=updated&per_page=8`,
        token,
      );
      repos.forEach((repo) => repoNames.add(repo.full_name));
    } catch (error) {
      await prisma.connectorAccount.update({
        where: { id: connector.id },
        data: { syncError: (error as Error).message },
      });
    }
  }

  const repos = uniqueStrings(Array.from(repoNames)).slice(0, 8);

  if (!repos.length) {
    await prisma.connectorAccount.update({
      where: { id: connector.id },
      data: {
        lastSyncedAt: new Date(),
        syncError: "Add a GitHub username or tracked repos to infer your stack.",
      },
    });

    return {
      connector: "GitHub",
      signalCount: 0,
      summary: "GitHub is configured but has no repos to analyze yet.",
    };
  }

  const inferredTerms: Array<{ label: string; weight?: number; provenance: string }> = [];

  for (const repoFullName of repos) {
    try {
      const [repo, languages] = await Promise.all([
        fetchGithubJson<RepoResponse>(
          `https://api.github.com/repos/${repoFullName}`,
          token,
        ),
        fetchGithubJson<Record<string, number>>(
          `https://api.github.com/repos/${repoFullName}/languages`,
          token,
        ),
      ]);

      inferredTerms.push({
        label: repo.full_name,
        weight: 0.78,
        provenance: `github:repo:${repo.full_name}`,
      });

      repo.topics?.forEach((topic) => {
        inferredTerms.push({
          label: topic,
          weight: 0.55,
          provenance: `github:topic:${repo.full_name}`,
        });
      });

      if (repo.description) {
        inferredTerms.push(
          ...repo.description.split(/[\s,/]+/).map((term) => ({
            label: term,
            weight: 0.22,
            provenance: `github:description:${repo.full_name}`,
          })),
        );
      }

      const totalLanguageBytes = Object.values(languages).reduce(
        (sum, value) => sum + value,
        0,
      );
      Object.entries(languages)
        .sort(([, left], [, right]) => right - left)
        .slice(0, 3)
        .forEach(([language, bytes]) => {
          inferredTerms.push({
            label: language,
            weight: totalLanguageBytes ? bytes / totalLanguageBytes : 0.5,
            provenance: `github:language:${repo.full_name}`,
          });
        });

      await prisma.trackedRepo.upsert({
        where: {
          userId_fullName: {
            userId: connector.userId,
            fullName: repo.full_name,
          },
        },
        update: {
          source: "github",
          activityScore: Math.min(1, 0.35 + repo.stargazers_count / 5000),
          lastSeenAt: new Date(repo.updated_at),
        },
        create: {
          userId: connector.userId,
          fullName: repo.full_name,
          source: "github",
          activityScore: Math.min(1, 0.35 + repo.stargazers_count / 5000),
          lastSeenAt: new Date(repo.updated_at),
        },
      });

      for (const manifestPath of GITHUB_MANIFESTS) {
        const manifestContent = await fetchGithubManifest(repo.full_name, manifestPath, token);
        if (!manifestContent) {
          continue;
        }

        extractDependencyNames(manifestPath, manifestContent).forEach((dependency) => {
          inferredTerms.push({
            label: dependency,
            weight: 0.58,
            provenance: `github:manifest:${repo.full_name}:${manifestPath}`,
          });
        });
      }
    } catch {
      inferredTerms.push({
        label: repoFullName,
        weight: 0.4,
        provenance: "github:tracked_repo",
      });
    }
  }

  const signals = inferSignalsFromTerms(inferredTerms)
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 32);
  const summary = summarizeSignals(signals.map((signal) => signal.label));

  await recordTelemetrySnapshot(
    connector.userId,
    ConnectorType.GITHUB,
    "GitHub",
    summary,
    signals,
  );

  await prisma.connectorAccount.update({
    where: { id: connector.id },
    data: {
      lastSyncedAt: new Date(),
      syncError: null,
    },
  });

  return {
    connector: "GitHub",
    signalCount: signals.length,
    summary,
  };
}

async function syncWakaTimeConnector(connector: ConnectorRecord) {
  if (!connector.accessToken) {
    await prisma.connectorAccount.update({
      where: { id: connector.id },
      data: {
        lastSyncedAt: new Date(),
        syncError: "Add a WakaTime API key to import editor and project signals.",
      },
    });

    return {
      connector: "WakaTime",
      signalCount: 0,
      summary: "WakaTime is connected in principle, but no API key is stored yet.",
    };
  }

  const response = await fetch(
    `https://wakatime.com/api/v1/users/current/stats/last_7_days?api_key=${connector.accessToken}`,
    { next: { revalidate: 0 } },
  );

  if (!response.ok) {
    const message = `WakaTime request failed (${response.status})`;
    await prisma.connectorAccount.update({
      where: { id: connector.id },
      data: {
        lastSyncedAt: new Date(),
        syncError: message,
      },
    });

    return {
      connector: "WakaTime",
      signalCount: 0,
      summary: message,
    };
  }

  const payload = (await response.json()) as {
    data?: {
      languages?: Array<{ name: string; percent?: number }>;
      editors?: Array<{ name: string; percent?: number }>;
      projects?: Array<{ name: string; percent?: number }>;
      categories?: Array<{ name: string; percent?: number }>;
    };
  };

  const inferredTerms: Array<{ label: string; weight?: number; provenance: string }> = [];
  payload.data?.languages?.forEach((language) =>
    inferredTerms.push({
      label: language.name,
      weight: (language.percent ?? 0) / 100,
      provenance: "wakatime:language",
    }),
  );
  payload.data?.editors?.forEach((editor) =>
    inferredTerms.push({
      label: editor.name,
      weight: (editor.percent ?? 0) / 100,
      provenance: "wakatime:editor",
    }),
  );
  payload.data?.projects?.forEach((project) =>
    inferredTerms.push({
      label: project.name,
      weight: Math.max(0.25, (project.percent ?? 0) / 100),
      provenance: "wakatime:project",
    }),
  );
  payload.data?.categories?.forEach((category) =>
    inferredTerms.push({
      label: category.name,
      weight: (category.percent ?? 0) / 100,
      provenance: "wakatime:category",
    }),
  );

  const signals = inferSignalsFromTerms(inferredTerms)
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 24);
  const summary = summarizeSignals(signals.map((signal) => signal.label));

  await recordTelemetrySnapshot(
    connector.userId,
    ConnectorType.WAKATIME,
    "WakaTime",
    summary,
    signals,
  );

  await prisma.connectorAccount.update({
    where: { id: connector.id },
    data: {
      lastSyncedAt: new Date(),
      syncError: null,
    },
  });

  return {
    connector: "WakaTime",
    signalCount: signals.length,
    summary,
  };
}

export async function importActivityWatchSummary(userId: string, rawPayload: string) {
  const parsed = JSON.parse(rawPayload) as Record<string, unknown>;
  const groups = [
    ...(Array.isArray(parsed.languages) ? parsed.languages : []),
    ...(Array.isArray(parsed.editors) ? parsed.editors : []),
    ...(Array.isArray(parsed.projects) ? parsed.projects : []),
    ...(Array.isArray(parsed.tools) ? parsed.tools : []),
  ] as Array<{ name?: string; hours?: number; weight?: number }>;

  const totalWeight =
    groups.reduce((sum, entry) => sum + (entry.hours ?? entry.weight ?? 1), 0) || 1;

  const inferredTerms = groups
    .filter((entry) => entry.name)
    .map((entry) => ({
      label: entry.name as string,
      weight: (entry.hours ?? entry.weight ?? 1) / totalWeight,
      provenance: "activitywatch:summary",
    }));

  const signals = inferSignalsFromTerms(inferredTerms)
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 24);
  const summary = summarizeSignals(signals.map((signal) => signal.label));

  const connector = await prisma.connectorAccount.upsert({
    where: {
      userId_type: {
        userId,
        type: ConnectorType.ACTIVITYWATCH,
      },
    },
    update: {
      active: true,
      configJson: stringifyJson({
        importedAt: new Date().toISOString(),
        rawPreview: truncate(rawPayload, 400),
      }),
      syncError: null,
      lastSyncedAt: new Date(),
    },
    create: {
      userId,
      type: ConnectorType.ACTIVITYWATCH,
      label: "ActivityWatch",
      active: true,
      configJson: stringifyJson({
        importedAt: new Date().toISOString(),
        rawPreview: truncate(rawPayload, 400),
      }),
      lastSyncedAt: new Date(),
    },
  });

  await recordTelemetrySnapshot(
    userId,
    ConnectorType.ACTIVITYWATCH,
    connector.label,
    summary,
    signals,
  );

  return {
    connector: "ActivityWatch",
    signalCount: signals.length,
    summary,
  };
}

export async function syncTelemetryForUser(userId: string) {
  const connectors = await prisma.connectorAccount.findMany({
    where: {
      userId,
      active: true,
      type: {
        in: [ConnectorType.GITHUB, ConnectorType.WAKATIME],
      },
    },
    include: {
      user: true,
    },
  });

  const results = [];
  for (const connector of connectors) {
    if (connector.type === ConnectorType.GITHUB) {
      results.push(await syncGithubConnector(connector));
    }
    if (connector.type === ConnectorType.WAKATIME) {
      results.push(await syncWakaTimeConnector(connector));
    }
  }

  if (!results.length) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const fallbackSignals = inferSignalsFromTerms([
      {
        label: user.interests || "AI developer tooling",
        weight: 0.55,
        provenance: "user:interests",
      },
    ]);
    const summary = summarizeSignals(fallbackSignals.map((signal) => signal.label));
    await recordTelemetrySnapshot(
      userId,
      ConnectorType.GITHUB,
      "Manual profile seed",
      summary,
      fallbackSignals,
    );
    return [
      {
        connector: "Manual seed",
        signalCount: fallbackSignals.length,
        summary,
      },
    ];
  }

  return results;
}

export function normalizeWatchedRepos(input: string) {
  return uniqueStrings(
    parseCsv(input).filter((repo) => /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo)),
  );
}
