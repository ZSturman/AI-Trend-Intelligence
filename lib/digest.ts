import { DetailLevel, DigestDeliveryType, RecommendationSection } from "@prisma/client";
import { Resend } from "resend";

import { prisma } from "@/lib/db";
import { env, hasResend } from "@/lib/env";
import { maybeGenerateDigestIntro } from "@/lib/llm";
import { compactNumber, describeRelativeDate, groupBy, percent } from "@/lib/utils";

const SECTION_LABELS: Record<RecommendationSection, string> = {
  ACT_NOW: "Act Now",
  MATCHED_TO_YOUR_WORK: "Matched to Your Work",
  WORTH_EVALUATING: "Worth Evaluating",
  KEEP_ON_RADAR: "Keep on Radar",
};

const SECTION_QUOTAS: Record<RecommendationSection, number> = {
  ACT_NOW: 3,
  MATCHED_TO_YOUR_WORK: 4,
  WORTH_EVALUATING: 3,
  KEEP_ON_RADAR: 2,
};

function pickDigestSummary(
  detailLevel: DetailLevel,
  candidate: { summary: string | null; actionableSummary: string | null; whyItMatters: string },
) {
  if (detailLevel === DetailLevel.HEADLINE) {
    return "";
  }
  if (detailLevel === DetailLevel.ACTIONABLE) {
    return candidate.actionableSummary ?? candidate.whyItMatters;
  }
  return candidate.summary ?? candidate.whyItMatters;
}

function renderHtmlDigest(input: {
  subject: string;
  intro: string;
  grouped: ReturnType<typeof groupBy<typeof inputCandidates[number], RecommendationSection>>;
  detailLevel: DetailLevel;
}) {
  const sections = Object.entries(input.grouped)
    .map(([section, entries]) => {
      const renderedEntries = entries
        .map((entry) => {
          const summary = pickDigestSummary(input.detailLevel, entry);
          return `
            <li style="margin: 0 0 18px;">
              <div style="font-size: 16px; font-weight: 700; margin-bottom: 6px;">
                <a href="${entry.url}" style="color: #e2e8f0; text-decoration: none;">${entry.title}</a>
              </div>
              <div style="color: #94a3b8; font-size: 13px; margin-bottom: 6px;">
                ${entry.sourceName} · ${describeRelativeDate(entry.publishedAt)} · Score ${percent(
                  Math.min(entry.finalScore, 1),
                )}
              </div>
              ${
                summary
                  ? `<div style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">${summary}</div>`
                  : ""
              }
              <div style="color: #67e8f9; font-size: 13px; margin-top: 6px;">Why shown: ${entry.whyShown}</div>
            </li>
          `;
        })
        .join("");

      return `
        <section style="margin-top: 28px;">
          <h2 style="margin: 0 0 12px; font-size: 18px; color: #f8fafc;">${SECTION_LABELS[
            section as RecommendationSection
          ]}</h2>
          <ul style="padding: 0; margin: 0; list-style: none;">${renderedEntries}</ul>
        </section>
      `;
    })
    .join("");

  return `
    <div style="background: #020617; color: #e2e8f0; padding: 32px; font-family: 'IBM Plex Sans', 'Avenir Next', sans-serif;">
      <div style="max-width: 720px; margin: 0 auto;">
        <p style="text-transform: uppercase; letter-spacing: 0.18em; font-size: 12px; color: #67e8f9;">AI Trend Intelligence</p>
        <h1 style="font-size: 32px; margin: 8px 0 12px;">${input.subject}</h1>
        <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1;">${input.intro}</p>
        ${sections}
      </div>
    </div>
  `;
}

function renderTextDigest(input: {
  subject: string;
  intro: string;
  grouped: ReturnType<typeof groupBy<typeof inputCandidates[number], RecommendationSection>>;
  detailLevel: DetailLevel;
}) {
  const sections = Object.entries(input.grouped)
    .map(([section, entries]) => {
      const lines = entries
        .map((entry) => {
          const summary = pickDigestSummary(input.detailLevel, entry);
          return [
            `- ${entry.title}`,
            `  ${entry.url}`,
            `  ${entry.sourceName} · ${describeRelativeDate(entry.publishedAt)}`,
            summary ? `  ${summary}` : "",
            `  Why shown: ${entry.whyShown}`,
          ]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n\n");

      return `${SECTION_LABELS[section as RecommendationSection]}\n${lines}`;
    })
    .join("\n\n");

  return `${input.subject}\n\n${input.intro}\n\n${sections}`;
}

const inputCandidates = [] as Array<{
  id: string;
  title: string;
  url: string;
  section: RecommendationSection;
  finalScore: number;
  whyShown: string;
  whyItMatters: string;
  summary: string | null;
  actionableSummary: string | null;
  sourceName: string;
  publishedAt: Date | null;
}>;

async function maybeSendEmail(to: string, subject: string, html: string, text: string) {
  if (!hasResend) {
    return { delivered: false, deliveryRef: null };
  }

  const resend = new Resend(env.resendApiKey);
  const response = await resend.emails.send({
    from: env.resendFrom,
    to,
    subject,
    html,
    text,
  });

  return {
    delivered: !response.error,
    deliveryRef: response.data?.id ?? null,
  };
}

export async function buildDigestForUser(userId: string, type: DigestDeliveryType) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      deliveryPreference: true,
      feedback: true,
    },
  });

  const recommendations = await prisma.recommendation.findMany({
    where: {
      userId,
      ...(type === DigestDeliveryType.ALERT
        ? {
            section: RecommendationSection.ACT_NOW,
            finalScore: {
              gte: user.deliveryPreference?.alertThreshold ?? 0.82,
            },
          }
        : {}),
    },
    include: {
      contentItem: true,
    },
    orderBy: [{ finalScore: "desc" }, { rank: "asc" }],
    take: type === DigestDeliveryType.ALERT ? 6 : 18,
  });

  const dismissedIds = new Set(
    user.feedback
      .filter((feedback) => feedback.type === "DISMISSED")
      .map((feedback) => feedback.contentItemId),
  );

  const candidates = recommendations
    .filter((recommendation) => !dismissedIds.has(recommendation.contentItemId))
    .map((recommendation) => ({
      id: recommendation.id,
      title: recommendation.contentItem.title,
      url: recommendation.contentItem.url,
      section: recommendation.section,
      finalScore: recommendation.finalScore,
      whyShown: recommendation.whyShown,
      whyItMatters: recommendation.whyItMatters,
      summary: recommendation.contentItem.summary,
      actionableSummary: recommendation.contentItem.actionableSummary,
      sourceName: recommendation.contentItem.sourceName,
      publishedAt: recommendation.contentItem.publishedAt,
    }));

  if (!candidates.length) {
    return null;
  }

  const bySection = groupBy(candidates, (candidate) => candidate.section);
  const selected = (
    Object.keys(SECTION_QUOTAS) as RecommendationSection[]
  ).flatMap((section) => (bySection[section] ?? []).slice(0, SECTION_QUOTAS[section]));
  const grouped = groupBy(selected, (candidate) => candidate.section);
  const subject =
    type === DigestDeliveryType.ALERT
      ? "AI Trend Alert"
      : `AI Trend Briefing · ${new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}`;
  const detailLevel = user.deliveryPreference?.detailLevel ?? DetailLevel.CONCISE;
  const heuristicIntro =
    type === DigestDeliveryType.ALERT
      ? `One or more high-trust items crossed your alert threshold. ${compactNumber(
          selected.length,
        )} item(s) deserve fast review.`
      : `The current digest leans toward ${selected
          .slice(0, 4)
          .map((candidate) => candidate.title)
          .join("; ")}.`;
  const profileSummary =
    (
      await prisma.profileSnapshot.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      })
    )?.summary ?? "No profile snapshot yet.";
  const intro =
    (await maybeGenerateDigestIntro({
      headline: subject,
      topTitles: selected.slice(0, 5).map((candidate) => candidate.title),
      profileSummary,
    })) ?? heuristicIntro;

  const html = renderHtmlDigest({
    subject,
    intro,
    grouped,
    detailLevel,
  });
  const text = renderTextDigest({
    subject,
    intro,
    grouped,
    detailLevel,
  });

  const digest = await prisma.digest.create({
    data: {
      userId,
      type,
      subject,
      previewText: intro,
      detailLevel,
      html,
      text,
      digestItems: {
        create: selected.map((candidate) => ({
          recommendationId: candidate.id,
          section: candidate.section,
          score: candidate.finalScore,
          title: candidate.title,
          url: candidate.url,
        })),
      },
    },
    include: {
      digestItems: true,
    },
  });

  const shouldSend =
    type === DigestDeliveryType.ALERT
      ? user.deliveryPreference?.alertsEnabled
      : user.deliveryPreference?.digestEnabled;

  if (shouldSend) {
    const delivery = await maybeSendEmail(user.email, subject, html, text);
    if (delivery.delivered || delivery.deliveryRef) {
      await prisma.digest.update({
        where: { id: digest.id },
        data: {
          delivered: delivery.delivered,
          deliveryRef: delivery.deliveryRef,
          sentAt: new Date(),
        },
      });
    }
  }

  return digest;
}
