import { ConnectorType, DetailLevel } from "@prisma/client";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { stringifyJson } from "@/lib/json";
import { DEFAULT_SOURCE_FEEDS } from "@/lib/source-registry";

export async function ensureSeedData() {
  const user = await prisma.user.upsert({
    where: { email: env.defaultUserEmail },
    update: {},
    create: {
      email: env.defaultUserEmail,
      displayName: "Solo Builder",
      interests: "AI tooling, coding models, developer workflow, benchmarks",
      focusAreas: "Stay current without tracking the entire AI feed manually.",
      deliveryPreference: {
        create: {
          cadence: "daily",
          detailLevel: DetailLevel.CONCISE,
          alertsEnabled: true,
          digestEnabled: true,
        },
      },
    },
    include: {
      deliveryPreference: true,
    },
  });

  if (!user.deliveryPreference) {
    await prisma.deliveryPreference.create({
      data: {
        userId: user.id,
        cadence: "daily",
        detailLevel: DetailLevel.CONCISE,
        alertsEnabled: true,
        digestEnabled: true,
      },
    });
  }

  const connectorSeeds = [
    {
      type: ConnectorType.GITHUB,
      label: "GitHub",
      accountKey: env.defaultGithubUsername || undefined,
      active: Boolean(env.defaultGithubUsername),
    },
    {
      type: ConnectorType.WAKATIME,
      label: "WakaTime",
      accountKey: undefined,
      active: false,
    },
    {
      type: ConnectorType.ACTIVITYWATCH,
      label: "ActivityWatch",
      accountKey: undefined,
      active: false,
    },
  ];

  for (const connector of connectorSeeds) {
    await prisma.connectorAccount.upsert({
      where: {
        userId_type: {
          userId: user.id,
          type: connector.type,
        },
      },
      update: {
        label: connector.label,
        accountKey: connector.accountKey ?? undefined,
        active: connector.active,
      },
      create: {
        userId: user.id,
        type: connector.type,
        label: connector.label,
        accountKey: connector.accountKey,
        active: connector.active,
        configJson: stringifyJson({ watchedRepos: [] }),
      },
    });
  }

  for (const feed of DEFAULT_SOURCE_FEEDS) {
    await prisma.sourceFeed.upsert({
      where: { key: feed.key },
      update: {
        label: feed.label,
        kind: feed.kind,
        sourceType: feed.sourceType,
        url: feed.url,
        repoFullName: feed.repoFullName,
        description: feed.description,
        trustScore: feed.trustScore,
        baseTagsJson: stringifyJson(feed.baseTags),
        cadence: feed.cadence,
        active: true,
      },
      create: {
        key: feed.key,
        label: feed.label,
        kind: feed.kind,
        sourceType: feed.sourceType,
        url: feed.url,
        repoFullName: feed.repoFullName,
        description: feed.description,
        trustScore: feed.trustScore,
        baseTagsJson: stringifyJson(feed.baseTags),
        cadence: feed.cadence,
        active: true,
      },
    });
  }

  return prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: {
      deliveryPreference: true,
      connectorAccounts: true,
      trackedRepos: true,
    },
  });
}

export async function getPrimaryUser() {
  const user = await ensureSeedData();
  return user;
}
