import { FeedbackType, RecommendationSection } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getLatestProfile } from "@/lib/profile";
import { groupBy, parseCsv } from "@/lib/utils";

export async function getDashboardData(userId: string) {
  const [user, connectors, sourceFeeds, profile, recommendations, digests] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        include: {
          deliveryPreference: true,
          trackedRepos: {
            orderBy: [{ activityScore: "desc" }, { updatedAt: "desc" }],
          },
          feedback: true,
        },
      }),
      prisma.connectorAccount.findMany({
        where: { userId },
        orderBy: { type: "asc" },
      }),
      prisma.sourceFeed.findMany({
        orderBy: [{ trustScore: "desc" }, { label: "asc" }],
      }),
      getLatestProfile(userId),
      prisma.recommendation.findMany({
        where: { userId },
        include: {
          contentItem: {
            include: {
              itemTags: true,
            },
          },
        },
        orderBy: [{ rank: "asc" }, { finalScore: "desc" }],
        take: 24,
      }),
      prisma.digest.findMany({
        where: { userId },
        orderBy: { generatedAt: "desc" },
        include: {
          digestItems: true,
        },
        take: 5,
      }),
    ]);

  const feedbackMap = new Map<string, FeedbackType[]>();
  user.feedback.forEach((feedback) => {
    const current = feedbackMap.get(feedback.contentItemId) ?? [];
    current.push(feedback.type);
    feedbackMap.set(feedback.contentItemId, current);
  });

  const groupedRecommendations = groupBy(
    recommendations.map((recommendation) => ({
      ...recommendation,
      feedback: feedbackMap.get(recommendation.contentItemId) ?? [],
    })),
    (recommendation) => recommendation.section,
  );

  const connectorCoverage = connectors.filter((connector) => connector.active).length;
  const urgentCount =
    groupedRecommendations[RecommendationSection.ACT_NOW]?.length ?? 0;

  return {
    user,
    connectors,
    sourceFeeds,
    profile,
    recommendations: groupedRecommendations,
    digests,
    stats: {
      connectorCoverage,
      urgentCount,
      trackedRepos: user.trackedRepos.length,
      sourceCoverage: sourceFeeds.length,
      interests: parseCsv(user.interests).length,
    },
  };
}
