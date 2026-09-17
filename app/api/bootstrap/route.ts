import { revalidatePath } from "next/cache";

import { getPrimaryUser } from "@/lib/bootstrap";
import { redirectWithStatus } from "@/lib/http";

export async function POST(request: Request) {
  await getPrimaryUser();
  revalidatePath("/");
  return redirectWithStatus(request.url, "bootstrap-complete");
}
