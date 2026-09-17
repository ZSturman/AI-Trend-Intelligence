import { ConnectorType } from "@prisma/client";

import { prisma } from "@/lib/db";
import { DerivedProfile, TelemetrySignal } from "@/lib/domain";
import { parseJson, stringifyJson } from "@/lib/json";
import { inferSignalsFromTerms } from "@/lib/intelligence";
import { parseCsv, uniqueStrings } from "@/lib/utils";

function aggregateSignals(signals: TelemetrySignal[]) {
  const merged = new Map<string, TelemetrySignal>();

  for (const signal of signals) {
    const key = `${signal.category}:${signal.label.toLowerCase()}`;
    const existing = merged.get(key);
    if (existing) {
      existing.weight = Math.min(1.4, existing.weight + signal.weight);
      existing.provenance = `${existing.provenance}, ${signal.provenance}`;
    } else {
      merged.set(key, { ...signal });
    }
  }

  return Array.from(merged.values())
    .map((signal) => ({
      ...signal,
      weight: Math.min(1, signal.weight),
    }))
    .sort((left, right) => right.weight - left.weight);
}

function topLabels(signals: TelemetrySignal[], category: TelemetrySignal["category"]) {
  return uniqueStrings(
    signals.filter((signal) => signal.category === category).map((signal) => signal.label),
  ).slice(0, 6);
}

function buildProfileNarrative(signals: TelemetrySignal[]) {
  if (!signals.length) {
    return {
      headline: "Waiting for developer telemetry",
      summary:
        "Connect GitHub, WakaTime, or ActivityWatch to start inferring what matters most to your current work.",
    };
  }

  const headline = `Tracking ${signals
    .slice(0, 4)
    .map((signal) => signal.label)
    .join(", ")}`;
  const summary = `The profile currently weighs ${signals
    .slice(0, 8)
    .map((signal) => signal.label)
    .join(", ")} most heavily when ranking AI developments.`;

  return { headline, summary };
}

export async function deriveProfileForUser(userId: string) {
  const [user, snapshots, trackedRepos] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.telemetrySnapshot.findMany({
      where: {
        userId,
        connectorType: {
          in: [ConnectorType.GITHUB, ConnectorType.WAKATIME, ConnectorType.ACTIVITYWATCH],
        },
      },
      orderBy: { capturedAt: "desc" },
      take: 12,
    }),
    prisma.trackedRepo.findMany({
      where: { userId },
      orderBy: [{ activityScore: "desc" }, { updatedAt: "desc" }],
      take: 12,
    }),
  ]);

  const latestByConnector = new Map<ConnectorType, typeof snapshots[number]>();
  snapshots.forEach((snapshot) => {
    if (!latestByConnector.has(snapshot.connectorType)) {
      latestByConnector.set(snapshot.connectorType, snapshot);
    }
  });

  const collectedSignals: TelemetrySignal[] = [];
  for (const snapshot of latestByConnector.values()) {
    const parsed = parseJson<{ signals?: TelemetrySignal[] }>(snapshot.dataJson, {
      signals: [],
    });
    collectedSignals.push(...(parsed.signals ?? []));
  }

  inferSignalsFromTerms(
    parseCsv(user.interests).map((interest) => ({
      label: interest,
      weight: 0.42,
      provenance: "user:interests",
    })),
  ).forEach((signal) => collectedSignals.push(signal));

  trackedRepos.forEach((repo) =>
    collectedSignals.push({
      label: repo.fullName,
      category: "repo",
      weight: repo.activityScore,
      provenance: `tracked-repo:${repo.source}`,
    }),
  );

  if (!collectedSignals.length) {
    inferSignalsFromTerms([
      {
        label: "AI tooling",
        weight: 0.55,
        provenance: "fallback",
      },
      {
        label: "developer workflow",
        weight: 0.45,
        provenance: "fallback",
      },
    ]).forEach((signal) => collectedSignals.push(signal));
  }

  const signals = aggregateSignals(collectedSignals);
  const { headline, summary } = buildProfileNarrative(signals);

  const profile: DerivedProfile = {
    headline,
    summary,
    signals,
    topLanguages: topLabels(signals, "language"),
    topFrameworks: topLabels(signals, "framework"),
    topTools: topLabels(signals, "tool"),
    topTopics: uniqueStrings(
      signals
        .filter((signal) => ["topic", "company", "workflow", "interest"].includes(signal.category))
        .map((signal) => signal.label),
    ).slice(0, 8),
    trackedRepos: trackedRepos.map((repo) => repo.fullName),
  };

  const snapshot = await prisma.profileSnapshot.create({
    data: {
      userId,
      headline: profile.headline,
      summary: profile.summary,
      signalsJson: stringifyJson(profile.signals),
      topLanguagesJson: stringifyJson(profile.topLanguages),
      topFrameworksJson: stringifyJson(profile.topFrameworks),
      topToolsJson: stringifyJson(profile.topTools),
      topTopicsJson: stringifyJson(profile.topTopics),
      trackedReposJson: stringifyJson(profile.trackedRepos),
    },
  });

  return { snapshot, profile };
}

export async function getLatestProfile(userId: string): Promise<DerivedProfile | null> {
  const snapshot = await prisma.profileSnapshot.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  if (!snapshot) {
    return null;
  }

  return {
    headline: snapshot.headline,
    summary: snapshot.summary,
    signals: parseJson(snapshot.signalsJson, [] as TelemetrySignal[]),
    topLanguages: parseJson(snapshot.topLanguagesJson, [] as string[]),
    topFrameworks: parseJson(snapshot.topFrameworksJson, [] as string[]),
    topTools: parseJson(snapshot.topToolsJson, [] as string[]),
    topTopics: parseJson(snapshot.topTopicsJson, [] as string[]),
    trackedRepos: parseJson(snapshot.trackedReposJson, [] as string[]),
  };
}
