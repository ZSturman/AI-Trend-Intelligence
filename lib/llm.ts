import { env, hasLlm } from "@/lib/env";

function extractOutputText(payload: any) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const text = payload?.output
    ?.flatMap((entry: any) => entry?.content ?? [])
    ?.find((entry: any) => entry?.type === "output_text")?.text;

  return typeof text === "string" ? text.trim() : null;
}

export async function maybeGenerateDigestIntro(input: {
  headline: string;
  topTitles: string[];
  profileSummary: string;
}) {
  if (!hasLlm) {
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.openAiModel,
        input: [
          {
            role: "system",
            content:
              "You write crisp digest intros for technically curious developers. Keep it under 80 words, concrete, and grounded in the provided items.",
          },
          {
            role: "user",
            content: JSON.stringify(input),
          },
        ],
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return extractOutputText(payload);
  } catch {
    return null;
  }
}
