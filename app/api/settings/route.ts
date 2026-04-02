import { DetailLevel } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { getPrimaryUser } from "@/lib/bootstrap";
import { prisma } from "@/lib/db";
import { stringifyJson } from "@/lib/json";
import { redirectWithStatus } from "@/lib/http";
import { normalizeWatchedRepos } from "@/lib/telemetry";

export async function POST(request: Request) {
  const user = await getPrimaryUser();
  const formData = await request.formData();

  const email = String(formData.get("email") ?? user.email).trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const interests = String(formData.get("interests") ?? "").trim();
  const focusAreas = String(formData.get("focusAreas") ?? "").trim();
  const detailLevel = String(formData.get("detailLevel") ?? "CONCISE") as DetailLevel;
  const alertThreshold = Number(formData.get("alertThreshold") ?? 0.82);
  const digestEnabled = formData.get("digestEnabled") === "on";
  const alertsEnabled = formData.get("alertsEnabled") === "on";
  const githubUsername = String(formData.get("githubUsername") ?? "").trim();
  const githubToken = String(formData.get("githubToken") ?? "").trim();
  const watchedRepos = normalizeWatchedRepos(String(formData.get("watchedRepos") ?? ""));
  const wakatimeToken = String(formData.get("wakatimeToken") ?? "").trim();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      email,
      displayName: displayName || null,
      interests,
      focusAreas,
    },
  });

  await prisma.deliveryPreference.upsert({
    where: { userId: user.id },
    update: {
      detailLevel,
      alertThreshold,
      digestEnabled,
      alertsEnabled,
    },
    create: {
      userId: user.id,
      detailLevel,
      alertThreshold,
      digestEnabled,
      alertsEnabled,
    },
  });

  await prisma.connectorAccount.update({
    where: {
      userId_type: {
        userId: user.id,
        type: "GITHUB",
      },
    },
    data: {
      label: "GitHub",
      accountKey: githubUsername || null,
      accessToken: githubToken || null,
      active: Boolean(githubUsername || githubToken || watchedRepos.length),
      configJson: stringifyJson({
        watchedRepos,
      }),
      syncError: null,
    },
  });

  await prisma.connectorAccount.update({
    where: {
      userId_type: {
        userId: user.id,
        type: "WAKATIME",
      },
    },
    data: {
      label: "WakaTime",
      accessToken: wakatimeToken || null,
      active: Boolean(wakatimeToken),
      syncError: null,
    },
  });

  await prisma.trackedRepo.deleteMany({
    where: {
      userId: user.id,
      source: "manual",
    },
  });

  if (watchedRepos.length) {
    for (const repo of watchedRepos) {
      await prisma.trackedRepo.upsert({
        where: {
          userId_fullName: {
            userId: user.id,
            fullName: repo,
          },
        },
        update: {
          source: "manual",
          activityScore: 0.72,
        },
        create: {
          userId: user.id,
          fullName: repo,
          source: "manual",
          activityScore: 0.72,
        },
      });
    }
  }

  revalidatePath("/");
  return redirectWithStatus(request.url, "settings-saved");
}
