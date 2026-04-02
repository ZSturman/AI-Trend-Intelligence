import Link from "next/link";

import {
  ConnectorType,
  DetailLevel,
  RecommendationSection,
} from "@prisma/client";
import {
  Activity,
  Bell,
  BookOpen,
  Cable,
  Compass,
  Flame,
  Layers2,
  Mail,
  Radar,
  Sparkles,
} from "lucide-react";

import { getDashboardData } from "@/lib/dashboard";
import { cn, compactNumber, describeRelativeDate, percent } from "@/lib/utils";

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
type RecommendationEntry =
  DashboardData["recommendations"][keyof DashboardData["recommendations"]][number];

const SECTION_META: Record<
  RecommendationSection,
  { title: string; accent: string; icon: typeof Flame; description: string }
> = {
  ACT_NOW: {
    title: "Act Now",
    accent: "from-orange-500/25 via-orange-300/10 to-transparent",
    icon: Flame,
    description: "High-trust items that are globally important or directly likely to affect current work.",
  },
  MATCHED_TO_YOUR_WORK: {
    title: "Matched to Your Work",
    accent: "from-cyan-500/25 via-cyan-300/10 to-transparent",
    icon: Compass,
    description: "Signals mapped to your active languages, frameworks, repos, and tools.",
  },
  WORTH_EVALUATING: {
    title: "Worth Evaluating",
    accent: "from-emerald-500/20 via-emerald-300/10 to-transparent",
    icon: Sparkles,
    description: "Benchmarks, releases, and docs that could change future choices.",
  },
  KEEP_ON_RADAR: {
    title: "Keep on Radar",
    accent: "from-slate-400/20 via-slate-200/10 to-transparent",
    icon: Radar,
    description: "Broader AI developments worth knowing without interrupting the current stack.",
  },
};

const DETAIL_LABELS: Record<DetailLevel, string> = {
  HEADLINE: "Headline only",
  CONCISE: "Concise",
  ACTIONABLE: "Actionable",
};

function StatCard(props: {
  title: string;
  value: string;
  hint: string;
  icon: typeof Flame;
}) {
  const Icon = props.icon;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_80px_rgba(2,8,23,0.5)] backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.22em] text-cyan-200/80">
          {props.title}
        </span>
        <Icon className="h-4 w-4 text-cyan-200" />
      </div>
      <div className="mt-4 text-3xl font-semibold text-white">{props.value}</div>
      <p className="mt-2 text-sm text-slate-300">{props.hint}</p>
    </div>
  );
}

function ConnectorCard(props: {
  connector: DashboardData["connectors"][number];
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-white">{props.connector.label}</div>
          <div className="mt-1 text-xs text-slate-400">{props.connector.type}</div>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            props.connector.active
              ? "bg-emerald-500/15 text-emerald-200"
              : "bg-slate-500/15 text-slate-300",
          )}
        >
          {props.connector.active ? "Active" : "Optional"}
        </span>
      </div>
      <div className="mt-4 text-sm text-slate-300">
        {props.connector.syncError ? props.connector.syncError : "Ready for sync."}
      </div>
      <div className="mt-3 text-xs text-slate-500">
        Last sync: {describeRelativeDate(props.connector.lastSyncedAt)}
      </div>
    </div>
  );
}

function RecommendationCard(props: {
  recommendation: RecommendationEntry;
}) {
  const tags = props.recommendation.contentItem.itemTags.slice(0, 5);
  const dismissed = props.recommendation.feedback.includes("DISMISSED");
  const saved = props.recommendation.feedback.includes("SAVED");

  return (
    <article className="rounded-3xl border border-white/10 bg-slate-950/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
              {props.recommendation.contentItem.sourceName}
            </span>
            <span className="text-xs text-slate-400">
              {describeRelativeDate(props.recommendation.contentItem.publishedAt)}
            </span>
          </div>
          <Link
            href={props.recommendation.contentItem.url}
            target="_blank"
            className="mt-3 block text-lg font-semibold leading-tight text-white transition hover:text-cyan-100"
          >
            {props.recommendation.contentItem.title}
          </Link>
        </div>
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-right">
          <div className="text-xs uppercase tracking-[0.16em] text-cyan-200/75">
            Rank Score
          </div>
          <div className="mt-1 text-xl font-semibold text-cyan-50">
            {percent(Math.min(props.recommendation.finalScore, 1))}
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-300">
        {props.recommendation.contentItem.summary ??
          props.recommendation.whyItMatters}
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-white/8 bg-white/5 p-4 text-sm text-slate-300">
          <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
            Why shown
          </div>
          <div className="mt-2">{props.recommendation.whyShown}</div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/5 p-4 text-sm text-slate-300">
          <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
            Why it matters
          </div>
          <div className="mt-2">{props.recommendation.whyItMatters}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={`${props.recommendation.id}-${tag.id}`}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
          >
            {tag.label}
          </span>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <form action="/api/feedback" method="post">
          <input type="hidden" name="contentItemId" value={props.recommendation.contentItemId} />
          <input type="hidden" name="type" value="SAVED" />
          <button
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition",
              saved
                ? "bg-emerald-400/20 text-emerald-100"
                : "bg-white/8 text-slate-200 hover:bg-white/12",
            )}
          >
            {saved ? "Saved" : "Save"}
          </button>
        </form>
        <form action="/api/feedback" method="post">
          <input type="hidden" name="contentItemId" value={props.recommendation.contentItemId} />
          <input type="hidden" name="type" value="DISMISSED" />
          <button
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition",
              dismissed
                ? "bg-orange-400/20 text-orange-100"
                : "bg-white/8 text-slate-200 hover:bg-white/12",
            )}
          >
            {dismissed ? "Dismissed" : "Dismiss"}
          </button>
        </form>
        <Link
          href={props.recommendation.contentItem.url}
          target="_blank"
          className="rounded-full border border-cyan-400/30 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/10"
        >
          Open source
        </Link>
      </div>
    </article>
  );
}

function SectionPanel(props: {
  section: RecommendationSection;
  entries: RecommendationEntry[];
}) {
  const meta = SECTION_META[props.section];
  const Icon = meta.icon;

  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6">
      <div
        className={cn(
          "rounded-[1.5rem] border border-white/10 bg-gradient-to-r p-5",
          meta.accent,
        )}
      >
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/8 p-3">
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">{meta.title}</h2>
            <p className="mt-1 text-sm text-slate-300">{meta.description}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {props.entries.length ? (
          props.entries.map((recommendation) => (
            <RecommendationCard key={recommendation.id} recommendation={recommendation} />
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-slate-400">
            Nothing landed here yet. Run a sync, connect more telemetry, or keep the demo content
            while you tune relevance.
          </div>
        )}
      </div>
    </section>
  );
}

function FlashBanner(props: { status?: string; detail?: string }) {
  if (!props.status) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">
      <span className="font-semibold capitalize">{props.status.replace(/-/g, " ")}</span>
      {props.detail ? <span className="text-cyan-100/80"> · {props.detail}</span> : null}
    </div>
  );
}

export function DashboardPage(props: {
  data: DashboardData;
  status?: string;
  detail?: string;
}) {
  const { data } = props;
  const github = data.connectors.find((connector) => connector.type === ConnectorType.GITHUB);
  const wakatime = data.connectors.find((connector) => connector.type === ConnectorType.WAKATIME);
  const activityWatch = data.connectors.find(
    (connector) => connector.type === ConnectorType.ACTIVITYWATCH,
  );
  const detailLevel = data.user.deliveryPreference?.detailLevel ?? DetailLevel.CONCISE;

  return (
    <main className="relative overflow-hidden px-5 py-8 md:px-8 lg:px-10">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_28%),radial-gradient(circle_at_80%_20%,_rgba(251,191,36,0.14),_transparent_24%),linear-gradient(180deg,#020617_0%,#020617_45%,#0f172a_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:36px_36px] opacity-[0.12]" />

      <div className="mx-auto max-w-7xl space-y-8">
        <FlashBanner status={props.status} detail={props.detail} />

        <section className="rounded-[2.5rem] border border-white/10 bg-slate-950/60 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur md:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/75">
                Personalized AI Trend Intelligence
              </p>
              <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
                A signal-first AI briefing system for one developer who does not want to babysit the feed.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
                The app watches curated AI sources, infers your active stack from lightweight telemetry,
                and ranks what matters using trust, recency, actionability, and personal fit.
              </p>
              <div className="mt-8 grid gap-4 md:grid-cols-4">
                <StatCard
                  title="Urgent"
                  value={compactNumber(data.stats.urgentCount)}
                  hint="High-priority items waiting right now."
                  icon={Flame}
                />
                <StatCard
                  title="Connectors"
                  value={`${data.stats.connectorCoverage}/3`}
                  hint="Active telemetry sources informing relevance."
                  icon={Cable}
                />
                <StatCard
                  title="Tracked repos"
                  value={compactNumber(data.stats.trackedRepos)}
                  hint="Repos currently shaping the profile."
                  icon={Layers2}
                />
                <StatCard
                  title="Source feeds"
                  value={compactNumber(data.stats.sourceCoverage)}
                  hint="Curated AI coverage sources in the registry."
                  icon={BookOpen}
                />
              </div>
            </div>

            <div className="space-y-4 rounded-[2rem] border border-white/10 bg-white/5 p-5">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">
                  Current profile
                </div>
                <div className="mt-3 text-2xl font-semibold text-white">
                  {data.profile?.headline ?? "Profile waiting for sync"}
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {data.profile?.summary ??
                    "Run a sync to derive weighted languages, frameworks, tools, repos, and AI interests."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(data.profile?.topLanguages ?? []).map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-50"
                  >
                    {label}
                  </span>
                ))}
                {(data.profile?.topFrameworks ?? []).map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-50"
                  >
                    {label}
                  </span>
                ))}
                {(data.profile?.topTools ?? []).map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-50"
                  >
                    {label}
                  </span>
                ))}
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Mail className="h-4 w-4 text-cyan-200" />
                  Delivery
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  {data.user.email} · {DETAIL_LABELS[detailLevel]} digest · alerts{" "}
                  {data.user.deliveryPreference?.alertsEnabled ? "enabled" : "disabled"}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <form action="/api/sync" method="post">
                    <input type="hidden" name="mode" value="sync" />
                    <button className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">
                      Run sync
                    </button>
                  </form>
                  <form action="/api/digest" method="post">
                    <input type="hidden" name="mode" value="digest" />
                    <button className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/8">
                      Send digest
                    </button>
                  </form>
                  <form action="/api/digest" method="post">
                    <input type="hidden" name="mode" value="alert" />
                    <button className="rounded-full border border-orange-300/20 px-4 py-2 text-sm font-medium text-orange-100 transition hover:bg-orange-400/10">
                      Send urgent alerts
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-8">
            <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-cyan-200" />
                <div>
                  <h2 className="text-xl font-semibold text-white">Onboarding and preferences</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Single-user setup with token-based integrations and least-privilege defaults.
                  </p>
                </div>
              </div>
              <form action="/api/settings" method="post" className="mt-6 space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Email</span>
                    <input
                      name="email"
                      defaultValue={data.user.email}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-slate-500"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Display name</span>
                    <input
                      name="displayName"
                      defaultValue={data.user.displayName ?? ""}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Digest detail</span>
                    <select
                      name="detailLevel"
                      defaultValue={detailLevel}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                    >
                      {Object.entries(DETAIL_LABELS).map(([value, label]) => (
                        <option key={value} value={value} className="bg-slate-950 text-white">
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">Alert threshold</span>
                    <input
                      type="number"
                      name="alertThreshold"
                      min="0.5"
                      max="0.99"
                      step="0.01"
                      defaultValue={data.user.deliveryPreference?.alertThreshold ?? 0.82}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                    />
                  </label>
                </div>

                <label className="space-y-2">
                  <span className="text-sm text-slate-300">General interests</span>
                  <textarea
                    name="interests"
                    defaultValue={data.user.interests}
                    rows={3}
                    className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm text-slate-300">What are you working on?</span>
                  <textarea
                    name="focusAreas"
                    defaultValue={data.user.focusAreas}
                    rows={3}
                    className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">GitHub username</span>
                    <input
                      name="githubUsername"
                      defaultValue={github?.accountKey ?? ""}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">GitHub token</span>
                    <input
                      name="githubToken"
                      defaultValue={github?.accessToken ?? ""}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                    />
                  </label>
                </div>

                <label className="space-y-2">
                  <span className="text-sm text-slate-300">Watched repos</span>
                  <input
                    name="watchedRepos"
                    defaultValue={data.user.trackedRepos.map((repo) => repo.fullName).join(", ")}
                    placeholder="owner/repo, owner/repo"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm text-slate-300">WakaTime API key</span>
                  <input
                    name="wakatimeToken"
                    defaultValue={wakatime?.accessToken ?? ""}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      name="digestEnabled"
                      defaultChecked={data.user.deliveryPreference?.digestEnabled ?? true}
                      className="h-4 w-4 rounded border-white/10 bg-slate-950"
                    />
                    Enable daily digest
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      name="alertsEnabled"
                      defaultChecked={data.user.deliveryPreference?.alertsEnabled ?? true}
                      className="h-4 w-4 rounded border-white/10 bg-slate-950"
                    />
                    Enable urgent alerts
                  </label>
                </div>

                <button className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100">
                  Save settings
                </button>
              </form>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-cyan-200" />
                <div>
                  <h2 className="text-xl font-semibold text-white">ActivityWatch import</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Import only aggregated editor, project, or language summaries. No raw window history required.
                  </p>
                </div>
              </div>
              <form
                action="/api/activitywatch/import"
                method="post"
                encType="multipart/form-data"
                className="mt-6 space-y-4"
              >
                <textarea
                  name="payload"
                  rows={8}
                  defaultValue=""
                  placeholder='{"languages":[{"name":"TypeScript","hours":7.5}],"editors":[{"name":"VS Code","hours":6.8}],"projects":[{"name":"agent-dashboard","hours":4.2}]}'
                  className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-white outline-none placeholder:text-slate-500"
                />
                <div className="flex items-center gap-4">
                  <input type="file" name="file" className="text-sm text-slate-300" />
                  <button className="rounded-full border border-cyan-400/30 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/10">
                    Import summary
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Current connector status: {activityWatch?.syncError ?? "Ready or waiting for import."}
                </p>
              </form>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6">
              <div className="flex items-center gap-3">
                <Cable className="h-5 w-5 text-cyan-200" />
                <div>
                  <h2 className="text-xl font-semibold text-white">Connector status</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Read-only connectors, manual source registry, and graceful sync failure handling.
                  </p>
                </div>
              </div>
              <div className="mt-6 grid gap-4">
                {data.connectors.map((connector) => (
                  <ConnectorCard key={connector.id} connector={connector} />
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-8">
            {(Object.keys(SECTION_META) as RecommendationSection[]).map((section) => (
              <SectionPanel
                key={section}
                section={section}
                entries={data.recommendations[section] ?? []}
              />
            ))}

            <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-cyan-200" />
                <div>
                  <h2 className="text-xl font-semibold text-white">Digest history</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Every generated digest is stored so the web app and email delivery stay in sync.
                  </p>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                {data.digests.length ? (
                  data.digests.map((digest) => (
                    <div
                      key={digest.id}
                      className="rounded-3xl border border-white/10 bg-white/5 p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">{digest.subject}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {digest.type} · {describeRelativeDate(digest.generatedAt)}
                          </div>
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-medium",
                            digest.delivered
                              ? "bg-emerald-400/15 text-emerald-100"
                              : "bg-slate-400/15 text-slate-300",
                          )}
                        >
                          {digest.delivered ? "Delivered" : "Stored preview"}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-slate-300">{digest.previewText}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                    No digests yet. Run a sync and send a digest to create the first briefing.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-cyan-200" />
                <div>
                  <h2 className="text-xl font-semibold text-white">Source registry</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Curated coverage beats indiscriminate crawling in the MVP.
                  </p>
                </div>
              </div>
              <div className="mt-6 grid gap-3">
                {data.sourceFeeds.map((feed) => (
                  <div
                    key={feed.id}
                    className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{feed.label}</div>
                        <div className="mt-1 text-xs text-slate-400">{feed.description}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                          Trust
                        </div>
                        <div className="mt-1 text-sm font-semibold text-cyan-100">
                          {percent(feed.trustScore)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-slate-500">
                      Last sync: {describeRelativeDate(feed.lastSyncedAt)} ·{" "}
                      {feed.lastSyncStatus ?? "pending"}
                      {feed.lastError ? ` · ${feed.lastError}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
