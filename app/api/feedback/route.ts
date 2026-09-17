import { FeedbackType } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { getPrimaryUser } from "@/lib/bootstrap";
import { prisma } from "@/lib/db";
import { redirectWithStatus } from "@/lib/http";

export async function POST(request: Request) {
  const user = await getPrimaryUser();
  const formData = await request.formData();
  const contentItemId = String(formData.get("contentItemId") ?? "");
  const type = String(formData.get("type") ?? "SAVED") as FeedbackType;

  if (!contentItemId) {
    return redirectWithStatus(request.url, "feedback-skipped", "Missing content item id.");
  }

  if (type === FeedbackType.SAVED) {
    await prisma.userFeedback.upsert({
      where: {
        userId_contentItemId_type: {
          userId: user.id,
          contentItemId,
          type: FeedbackType.SAVED,
        },
      },
      update: {},
      create: {
        userId: user.id,
        contentItemId,
        type: FeedbackType.SAVED,
      },
    });
    await prisma.userFeedback.deleteMany({
      where: {
        userId: user.id,
        contentItemId,
        type: FeedbackType.DISMISSED,
      },
    });
  }

  if (type === FeedbackType.DISMISSED) {
    await prisma.userFeedback.upsert({
      where: {
        userId_contentItemId_type: {
          userId: user.id,
          contentItemId,
          type: FeedbackType.DISMISSED,
        },
      },
      update: {},
      create: {
        userId: user.id,
        contentItemId,
        type: FeedbackType.DISMISSED,
      },
    });
    await prisma.userFeedback.deleteMany({
      where: {
        userId: user.id,
        contentItemId,
        type: FeedbackType.SAVED,
      },
    });
  }

  revalidatePath("/");
  return redirectWithStatus(request.url, "feedback-updated");
}
