import { RecommendationSection } from "@prisma/client";

export type FeedKind = "rss" | "github_releases";

export type SignalCategory =
  | "language"
  | "framework"
  | "tool"
  | "repo"
  | "interest"
  | "workflow"
  | "company"
  | "topic"
  | "editor"
  | "project"
  | "source"
  | "format";

export interface DomainTag {
  label: string;
  category: SignalCategory;
  weight: number;
  source: string;
}

export interface SourceFeedSeed {
  key: string;
  label: string;
  kind: FeedKind;
  sourceType: string;
  url?: string;
  repoFullName?: string;
  description: string;
  trustScore: number;
  baseTags: string[];
  cadence: string;
}

export interface NormalizedContentItem {
  dedupeKey: string;
  title: string;
  url: string;
  canonicalUrl: string;
  domain: string;
  sourceName: string;
  sourceType: string;
  contentKind: string;
  author?: string;
  publishedAt?: Date;
  summary?: string;
  actionableSummary?: string;
  whyItMattersTemplate?: string;
  metadata: Record<string, unknown>;
  tags: DomainTag[];
  trustScore: number;
  ecosystemImportance: number;
  actionability: number;
  freshness: number;
}

export interface TelemetrySignal {
  label: string;
  category: Exclude<SignalCategory, "source" | "format">;
  weight: number;
  provenance: string;
}

export interface ConnectorSyncResult {
  connector: string;
  signalCount: number;
  summary: string;
}

export interface DerivedProfile {
  headline: string;
  summary: string;
  signals: TelemetrySignal[];
  topLanguages: string[];
  topFrameworks: string[];
  topTools: string[];
  topTopics: string[];
  trackedRepos: string[];
}

export interface RecommendationScoreBreakdown {
  finalScore: number;
  personalRelevance: number;
  ecosystemImportance: number;
  actionability: number;
  freshness: number;
  trustMultiplier: number;
}

export interface RankedDigestCandidate {
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
  tags: string[];
}
