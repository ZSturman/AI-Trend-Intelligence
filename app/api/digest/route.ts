import { DigestDeliveryType } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { getPrimaryUser } from "@/lib/bootstrap";
import { buildDigestForUser } from "@/lib/digest";
import { redirectWithStatus } from "@/lib/http";

export async function POST(request: Request) {
  const user = await getPrimaryUser();
  const formData = await request.formData();
  const mode = String(formData.get("mode") ?? "digest");
  const digest = await buildDigestForUser(
    user.id,
    mode === "alert" ? DigestDeliveryType.ALERT : DigestDeliveryType.DIGEST,
  );
  revalidatePath("/");
  return redirectWithStatus(
    request.url,
    digest ? "digest-ready" : "no-digest-items",
    digest ? digest.subject : "No recommendations matched the current digest criteria.",
  );
}
