import { revalidatePath } from "next/cache";

import { DigestDeliveryType } from "@prisma/client";

import { getPrimaryUser } from "@/lib/bootstrap";
import { buildDigestForUser } from "@/lib/digest";
import { env } from "@/lib/env";
import { redirectWithStatus } from "@/lib/http";
import { runSourceSync } from "@/lib/ingestion";
import { deriveProfileForUser } from "@/lib/profile";
import { rankRecommendationsForUser } from "@/lib/ranking";
import { syncTelemetryForUser } from "@/lib/telemetry";

async function executeSync(userId: string, mode: string) {
  const sourceSummary = await runSourceSync();
  const telemetrySummary = await syncTelemetryForUser(userId);
  await deriveProfileForUser(userId);
  const ranked = await rankRecommendationsForUser(userId);

  if (mode === "sync_and_digest") {
    await buildDigestForUser(userId, DigestDeliveryType.DIGEST);
  }

  return {
    detail: `${sourceSummary.persisted + sourceSummary.demoInserted} items processed, ${telemetrySummary.length} telemetry source(s), ${ranked.length} ranked recommendations`,
  };
}

export async function GET(request: Request) {
  if (!env.cronSecret) {
    return new Response("Cron secret not configured", { status: 400 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== env.cronSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await getPrimaryUser();
  const result = await executeSync(user.id, "sync");
  revalidatePath("/");
  return Response.json({ ok: true, ...result });
}

export async function POST(request: Request) {
  const user = await getPrimaryUser();
  const formData = await request.formData();
  const mode = String(formData.get("mode") ?? "sync");
  const result = await executeSync(user.id, mode);
  revalidatePath("/");
  return redirectWithStatus(request.url, "sync-complete", result.detail);
}
