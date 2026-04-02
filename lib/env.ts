export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "file:./dev.db",
  defaultUserEmail: process.env.DEFAULT_USER_EMAIL ?? "developer@example.com",
  defaultGithubUsername: process.env.GITHUB_USERNAME?.trim() ?? "",
  cronSecret: process.env.CRON_SECRET?.trim() ?? "",
  openAiApiKey: process.env.OPENAI_API_KEY?.trim() ?? "",
  openAiModel: process.env.OPENAI_MODEL?.trim() ?? "",
  resendApiKey: process.env.RESEND_API_KEY?.trim() ?? "",
  resendFrom:
    process.env.RESEND_FROM?.trim() ?? "AI Trend Intel <onboarding@resend.dev>",
  activityWatchImportSecret:
    process.env.ACTIVITYWATCH_IMPORT_SECRET?.trim() ?? "",
};

export const hasLlm = Boolean(env.openAiApiKey && env.openAiModel);
export const hasResend = Boolean(env.resendApiKey && env.resendFrom);
