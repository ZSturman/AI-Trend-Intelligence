import Parser from "rss-parser";

import { ConnectorType } from "@prisma/client";

import { prisma } from "@/lib/db";
import { NormalizedContentItem, SourceFeedSeed } from "@/lib/domain";
import { parseJson, stringifyJson } from "@/lib/json";
import {
  buildFingerprint,
  computeActionability,
  computeFreshness,
  computeGlobalImportance,
  inferContentKind,
  inferTagsFromText,
  summarizeText,
} from "@/lib/intelligence";
import { DEMO_FALLBACK_ITEMS, demoItemKey } from "@/lib/source-registry";
import { canonicalize, truncate } from "@/lib/utils";

const parser = new Parser();

function extractDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function buildDedupeKey(title: string, contentKind: string, sourceName: string) {
  return buildFingerprint(contentKind, canonicalize(title).slice(0, 140), sourceName);
}

async function fetchRssFeed(feed: SourceFeedSeed): Promise<NormalizedContentItem[]> {
  if (!feed.url) {
    return [];
  }

  const response = await fetch(feed.url, {
    headers: {
      "User-Agent": "AI-Trend-Intel-MVP",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`Feed request failed (${response.status})`);
  }

  const xml = await response.text();
  const parsed = await parser.parseString(xml);
  const items = parsed.items?.slice(0, 10) ?? [];

  const normalizedItems: NormalizedContentItem[] = [];

  for (const entry of items) {
      const url = entry.link?.trim();
      if (!url || !entry.title) {
        continue;
      }

      const summary = summarizeText(
        entry.contentSnippet ?? entry.content ?? entry.summary ?? entry.title,
      );
      const publishedAt = entry.isoDate
        ? new Date(entry.isoDate)
        : entry.pubDate
          ? new Date(entry.pubDate)
          : undefined;
      const tags = inferTagsFromText(
        `${entry.title} ${summary}`,
        feed.baseTags,
        feed.key,
      );
      const contentKind = inferContentKind(entry.title, feed.sourceType);
      const trustScore = feed.trustScore;

      normalizedItems.push({
        dedupeKey: buildDedupeKey(entry.title, contentKind, feed.label),
        title: entry.title,
        url,
        canonicalUrl: url,
        domain: extractDomain(url),
        sourceName: feed.label,
        sourceType: feed.sourceType,
        contentKind,
        author: entry.creator ?? entry.author,
        publishedAt,
        summary,
        actionableSummary:
          contentKind === "release"
            ? "Check the changelog for migrations, new capabilities, and integration changes."
            : undefined,
        whyItMattersTemplate: undefined,
        metadata: {
          feedKey: feed.key,
          guid: entry.guid ?? null,
        },
        tags,
        trustScore,
        ecosystemImportance: computeGlobalImportance(
          entry.title,
          feed.sourceType,
          tags,
          trustScore,
        ),
        actionability: computeActionability(entry.title, summary, tags),
        freshness: computeFreshness(publishedAt),
      } satisfies NormalizedContentItem);
    }

  return normalizedItems;
}

async function fetchGithubReleases(
  feed: SourceFeedSeed,
  token?: string,
): Promise<NormalizedContentItem[]> {
  if (!feed.repoFullName) {
    return [];
  }

  const response = await fetch(
    `https://api.github.com/repos/${feed.repoFullName}/releases?per_page=6`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "User-Agent": "AI-Trend-Intel-MVP",
      },
      next: { revalidate: 0 },
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub releases request failed (${response.status})`);
  }

  const releases = (await response.json()) as Array<{
    name: string | null;
    tag_name: string;
    html_url: string;
    published_at: string | null;
    body: string | null;
    author?: { login?: string };
  }>;

  return releases
    .filter((release) => Boolean(release.html_url))
    .map((release) => {
      const title = `${feed.repoFullName} ${release.name ?? release.tag_name}`;
      const summary = summarizeText(release.body ?? title);
      const publishedAt = release.published_at ? new Date(release.published_at) : undefined;
      const tags = inferTagsFromText(`${title} ${summary}`, feed.baseTags, feed.key);
      const trustScore = feed.trustScore;

      return {
        dedupeKey: buildDedupeKey(title, "release", feed.repoFullName ?? feed.label),
        title,
        url: release.html_url,
        canonicalUrl: release.html_url,
        domain: extractDomain(release.html_url),
        sourceName: feed.label,
        sourceType: feed.sourceType,
        contentKind: "release",
        author: release.author?.login,
        publishedAt,
        summary,
        actionableSummary:
          "Check the release notes for migrations, new APIs, and behavior changes relevant to your current stack.",
        whyItMattersTemplate: undefined,
        metadata: {
          repo: feed.repoFullName,
          tag: release.tag_name,
        },
        tags,
        trustScore,
        ecosystemImportance: computeGlobalImportance(title, feed.sourceType, tags, trustScore),
        actionability: computeActionability(title, summary, tags),
        freshness: computeFreshness(publishedAt),
      } satisfies NormalizedContentItem;
    });
}

async function persistItem(sourceFeedId: string | null, item: NormalizedContentItem) {
  const contentItem = await prisma.contentItem.upsert({
    where: { dedupeKey: item.dedupeKey },
    update: {
      sourceFeedId,
      title: item.title,
      url: item.url,
      canonicalUrl: item.canonicalUrl,
      domain: item.domain,
      sourceName: item.sourceName,
      sourceType: item.sourceType,
      contentKind: item.contentKind,
      author: item.author,
      publishedAt: item.publishedAt,
      summary: item.summary,
      actionableSummary: item.actionableSummary,
      whyItMattersTemplate: item.whyItMattersTemplate,
      tagsJson: stringifyJson(item.tags.map((tag) => tag.label)),
      metadataJson: stringifyJson(item.metadata),
      trustScore: item.trustScore,
      ecosystemImportance: item.ecosystemImportance,
      actionability: item.actionability,
      freshness: item.freshness,
    },
    create: {
      sourceFeedId,
      dedupeKey: item.dedupeKey,
      title: item.title,
      url: item.url,
      canonicalUrl: item.canonicalUrl,
      domain: item.domain,
      sourceName: item.sourceName,
      sourceType: item.sourceType,
      contentKind: item.contentKind,
      author: item.author,
      publishedAt: item.publishedAt,
      summary: item.summary,
      actionableSummary: item.actionableSummary,
      whyItMattersTemplate: item.whyItMattersTemplate,
      tagsJson: stringifyJson(item.tags.map((tag) => tag.label)),
      metadataJson: stringifyJson(item.metadata),
      trustScore: item.trustScore,
      ecosystemImportance: item.ecosystemImportance,
      actionability: item.actionability,
      freshness: item.freshness,
    },
  });

  await prisma.itemTag.deleteMany({
    where: { contentItemId: contentItem.id },
  });

  if (item.tags.length) {
    await prisma.itemTag.createMany({
      data: item.tags.map((tag) => ({
        contentItemId: contentItem.id,
        label: tag.label,
        category: tag.category,
        weight: tag.weight,
        source: tag.source,
      })),
    });
  }

  if (sourceFeedId) {
    await prisma.rawIngestRecord.create({
      data: {
        sourceFeedId,
        contentItemId: contentItem.id,
        fingerprint: buildFingerprint(item.dedupeKey, item.title, item.url),
        payload: truncate(stringifyJson(item.metadata), 2000),
      },
    });
  }

  return contentItem;
}

async function seedDemoContentIfNeeded() {
  const existingCount = await prisma.contentItem.count();
  if (existingCount > 0) {
    return 0;
  }

  for (const demoItem of DEMO_FALLBACK_ITEMS) {
    const tags = inferTagsFromText(
      `${demoItem.title} ${demoItem.summary}`,
      demoItem.tags,
      "demo",
    );

    await persistItem(null, {
      dedupeKey: demoItemKey(demoItem.title, demoItem.url),
      title: demoItem.title,
      url: demoItem.url,
      canonicalUrl: demoItem.url,
      domain: extractDomain(demoItem.url),
      sourceName: demoItem.sourceName,
      sourceType: demoItem.sourceType,
      contentKind: "article",
      summary: demoItem.summary,
      actionableSummary: "Use this as fallback sample data to verify ranking and digest behavior.",
      metadata: { seeded: true },
      tags,
      trustScore: 0.82,
      ecosystemImportance: 0.68,
      actionability: 0.74,
      freshness: 0.62,
    });
  }

  return DEMO_FALLBACK_ITEMS.length;
}

export async function runSourceSync() {
  const githubConnector = await prisma.connectorAccount.findFirst({
    where: {
      type: ConnectorType.GITHUB,
      active: true,
      accessToken: {
        not: null,
      },
    },
  });

  const feeds = await prisma.sourceFeed.findMany({
    where: { active: true },
    orderBy: [{ trustScore: "desc" }, { label: "asc" }],
  });

  let persisted = 0;
  const feedResults: Array<{ feed: string; items: number; error?: string }> = [];

  for (const feed of feeds) {
    const feedSeed: SourceFeedSeed = {
      key: feed.key,
      label: feed.label,
      kind: feed.kind as SourceFeedSeed["kind"],
      sourceType: feed.sourceType,
      url: feed.url ?? undefined,
      repoFullName: feed.repoFullName ?? undefined,
      description: feed.description,
      trustScore: feed.trustScore,
      baseTags: parseJson(feed.baseTagsJson, [] as string[]),
      cadence: feed.cadence,
    };

    try {
      const items =
        feed.kind === "github_releases"
          ? await fetchGithubReleases(feedSeed, githubConnector?.accessToken ?? undefined)
          : await fetchRssFeed(feedSeed);

      for (const item of items) {
        await persistItem(feed.id, item);
        persisted += 1;
      }

      await prisma.sourceFeed.update({
        where: { id: feed.id },
        data: {
          lastSyncedAt: new Date(),
          lastSyncStatus: "ok",
          lastError: null,
        },
      });

      feedResults.push({ feed: feed.label, items: items.length });
    } catch (error) {
      await prisma.sourceFeed.update({
        where: { id: feed.id },
        data: {
          lastSyncedAt: new Date(),
          lastSyncStatus: "error",
          lastError: (error as Error).message,
        },
      });

      feedResults.push({
        feed: feed.label,
        items: 0,
        error: (error as Error).message,
      });
    }
  }

  const demoInserted = await seedDemoContentIfNeeded();

  return {
    persisted,
    demoInserted,
    feedResults,
  };
}
