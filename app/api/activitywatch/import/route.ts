import { revalidatePath } from "next/cache";

import { getPrimaryUser } from "@/lib/bootstrap";
import { redirectWithStatus } from "@/lib/http";
import { importActivityWatchSummary } from "@/lib/telemetry";

export async function POST(request: Request) {
  const user = await getPrimaryUser();
  const formData = await request.formData();
  const payload = String(formData.get("payload") ?? "").trim();
  const file = formData.get("file");

  let rawPayload = payload;
  if (!rawPayload && file instanceof File) {
    rawPayload = await file.text();
  }

  if (!rawPayload) {
    return redirectWithStatus(
      request.url,
      "import-skipped",
      "Paste or upload an aggregated ActivityWatch summary.",
    );
  }

  try {
    const result = await importActivityWatchSummary(user.id, rawPayload);
    revalidatePath("/");
    return redirectWithStatus(request.url, "activitywatch-imported", result.summary);
  } catch (error) {
    return redirectWithStatus(
      request.url,
      "activitywatch-error",
      (error as Error).message,
    );
  }
}
