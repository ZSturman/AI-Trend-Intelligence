import { FeedbackType, RecommendationSection } from "@prisma/client";

import { prisma } from "@/lib/db";
import { TelemetrySignal } from "@/lib/domain";
import { getLatestProfile } from "@/lib/profile";
import {
  summarizeWhyItMatters,
  summarizeWhyShown,
  trustMultiplier,
} from "@/lib/intelligence";
import { canonicalize, clamp } from "@/lib/utils";

function computeMatchScore(itemTags: Array<{ label: string; weight: number }>, signals: TelemetrySignal[]) {
  const matches: TelemetrySignal[] = [];
  let score = 0;

  for (const signal of signals.slice(0, 18)) {
    const canonicalSignal = canonicalize(signal.label);
    const tagMatch = itemTags.find((tag) => {
      const canonicalTag = canonicalize(tag.label);
      return (
        canonicalTag === canonicalSignal ||
        canonicalTag.includes(canonicalSignal) ||
        canonicalSignal.includes(canonicalTag)
      );
    });

    if (!tagMatch) {
      continue;
    }

    const matchStrength = signal.weight * tagMatch.weight;
    score += matchStrength;
    matches.push(signal);
  }

  return {
    personalRelevance: clamp(score / 2.4, 0.03, 1),
    matches,
  };
}

function chooseSection(
  finalScore: number,
  personalRelevance: number,
  ecosystemImportance: number,
  actionability: number,
) {
  if (finalScore >= 0.82 || (ecosystemImportance > 0.8 && actionability > 0.62)) {
    return RecommendationSection.ACT_NOW;
  }
  if (personalRelevance >= 0.44) {
    return RecommendationSection.MATCHED_TO_YOUR_WORK;
  }
  if (actionability >= 0.55 || ecosystemImportance >= 0.62) {
    return RecommendationSection.WORTH_EVALUATING;
  }

  return RecommendationSection.KEEP_ON_RADAR;
}

export async function rankRecommendationsForUser(userId: string) {
  const profile = await getLatestProfile(userId);
  const signals = profile?.signals ?? [];
  const dismissed = await prisma.userFeedback.findMany({
    where: { userId, type: FeedbackType.DISMISSED },
    select: { contentItemId: true },
  });
  const dismissedIds = new Set(dismissed.map((item) => item.contentItemId));

  const items = await prisma.contentItem.findMany({
    where: {
      OR: [
        { publishedAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 21) } },
        { sourceType: "seeded_demo" },
      ],
    },
    include: {
      itemTags: true,
    },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    take: 120,
  });

  const ranked = items
    .filter((item) => !dismissedIds.has(item.id))
    .map((item) => {
      const itemTags = item.itemTags.map((tag) => ({
        label: tag.label,
        weight: tag.weight,
      }));
      const { personalRelevance, matches } = computeMatchScore(itemTags, signals);
      const multiplier = trustMultiplier(item.trustScore);
      const finalScore =
        ((0.35 * personalRelevance +
          0.3 * item.ecosystemImportance +
          0.2 * item.actionability +
          0.15 * item.freshness) *
          multiplier);

      return {
        item,
        matches,
        personalRelevance,
        ecosystemImportance: item.ecosystemImportance,
        actionability: item.actionability,
        freshness: item.freshness,
        trustMultiplier: multiplier,
        finalScore,
        section: chooseSection(
          finalScore,
          personalRelevance,
          item.ecosystemImportance,
          item.actionability,
        ),
      };
    })
    .sort((left, right) => right.finalScore - left.finalScore)
    .slice(0, 40);

  await prisma.recommendation.deleteMany({
    where: { userId },
  });

  for (const [index, rankedItem] of ranked.entries()) {
    await prisma.recommendation.create({
      data: {
        userId,
        contentItemId: rankedItem.item.id,
        section: rankedItem.section,
        finalScore: rankedItem.finalScore,
        personalRelevance: rankedItem.personalRelevance,
        ecosystemImportance: rankedItem.ecosystemImportance,
        actionability: rankedItem.actionability,
        freshness: rankedItem.freshness,
        trustMultiplier: rankedItem.trustMultiplier,
        rank: index + 1,
        whyShown: summarizeWhyShown(rankedItem.matches),
        whyItMatters: summarizeWhyItMatters(
          rankedItem.item.title,
          rankedItem.item.summary ?? rankedItem.item.actionableSummary ?? "",
          rankedItem.item.itemTags.map((tag) => ({
            label: tag.label,
            category: "topic",
            weight: tag.weight,
            source: "ranking",
          })),
        ),
      },
    });
  }

  return ranked;
}
