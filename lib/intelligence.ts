import { createHash } from "node:crypto";

import { DomainTag, TelemetrySignal } from "@/lib/domain";
import { canonicalize, clamp, truncate } from "@/lib/utils";

const SIGNAL_CATALOG: Array<{
  label: string;
  category: TelemetrySignal["category"];
  terms: string[];
}> = [
  { label: "TypeScript", category: "language", terms: ["typescript", "tsconfig", "ts-node"] },
  { label: "JavaScript", category: "language", terms: ["javascript", "node.js", "nodejs"] },
  { label: "Python", category: "language", terms: ["python", "pyproject", "pytorch"] },
  { label: "Go", category: "language", terms: ["golang", "go.mod", "go "] },
  { label: "Rust", category: "language", terms: ["rust", "cargo.toml"] },
  { label: "React", category: "framework", terms: ["react", "jsx"] },
  { label: "Next.js", category: "framework", terms: ["next.js", "nextjs", "app router"] },
  { label: "Vercel AI SDK", category: "tool", terms: ["vercel ai", "ai sdk", "@ai-sdk", "vercel/ai"] },
  { label: "LangChain", category: "tool", terms: ["langchain"] },
  { label: "LlamaIndex", category: "tool", terms: ["llamaindex"] },
  { label: "Transformers", category: "tool", terms: ["transformers", "huggingface transformers"] },
  { label: "OpenAI", category: "company", terms: ["openai", "gpt-4", "gpt-5", "o3"] },
  { label: "Anthropic", category: "company", terms: ["anthropic", "claude"] },
  { label: "Google", category: "company", terms: ["gemini", "google deepmind", "vertex ai", "google ai"] },
  { label: "Meta", category: "company", terms: ["llama", "meta ai"] },
  { label: "GitHub Copilot", category: "tool", terms: ["copilot", "github copilot"] },
  { label: "Cursor", category: "tool", terms: ["cursor"] },
  { label: "Claude Code", category: "tool", terms: ["claude code"] },
  { label: "VS Code", category: "editor", terms: ["visual studio code", "vscode"] },
  { label: "Neovim", category: "editor", terms: ["neovim", "nvim"] },
  { label: "Benchmarks", category: "topic", terms: ["benchmark", "eval", "arena", "comparison"] },
  { label: "Agents", category: "topic", terms: ["agent", "agentic"] },
  { label: "Inference", category: "topic", terms: ["inference", "serving"] },
  { label: "Fine-tuning", category: "topic", terms: ["fine-tune", "fine tuning"] },
  { label: "Pricing", category: "topic", terms: ["pricing", "price cut", "cost", "token pricing"] },
  { label: "API", category: "workflow", terms: ["api", "sdk", "endpoint"] },
  { label: "Release Notes", category: "workflow", terms: ["release note", "changelog", "release"] },
];

const HIGH_URGENCY_TERMS = [
  "launch",
  "announces",
  "introduces",
  "deprecates",
  "pricing",
  "benchmark",
  "security",
  "release notes",
  "model",
];

const ACTIONABILITY_TERMS = [
  "sdk",
  "guide",
  "tutorial",
  "migration",
  "release",
  "api",
  "benchmark",
  "price",
  "cookbook",
  "sample",
];

export function inferTagsFromText(
  text: string,
  baseTags: string[] = [],
  source = "heuristic",
): DomainTag[] {
  const haystack = canonicalize(text);
  const matches = SIGNAL_CATALOG.filter(({ terms }) =>
    terms.some((term) => haystack.includes(canonicalize(term))),
  ).map((match) => ({
    label: match.label,
    category: match.category,
    weight: 0.7,
    source,
  }));

  const inferredBaseTags = baseTags.map<DomainTag>((tag) => ({
    label: tag,
    category: "topic",
    weight: 0.45,
    source: "feed",
  }));

  const unique = new Map<string, DomainTag>();

  [...matches, ...inferredBaseTags].forEach((tag) => {
    const key = `${canonicalize(tag.label)}:${tag.category}`;
    if (!unique.has(key) || (unique.get(key)?.weight ?? 0) < tag.weight) {
      unique.set(key, tag);
    }
  });

  return Array.from(unique.values());
}

export function inferSignalsFromTerms(
  terms: Array<{ label: string; weight?: number; provenance: string }>,
) {
  const signals: TelemetrySignal[] = [];

  for (const term of terms) {
    const normalized = canonicalize(term.label);
    const exactMatch = SIGNAL_CATALOG.find(
      ({ label }) => canonicalize(label) === normalized,
    );
    const fuzzyMatch = SIGNAL_CATALOG.find(({ terms }) =>
      terms.some((candidate) => normalized.includes(canonicalize(candidate))),
    );
    const match = exactMatch ?? fuzzyMatch;

    if (match) {
      signals.push({
        label: match.label,
        category: match.category,
        weight: clamp(term.weight ?? 0.6, 0.1, 1),
        provenance: term.provenance,
      });
      continue;
    }

    signals.push({
      label: term.label,
      category: "interest",
      weight: clamp(term.weight ?? 0.45, 0.1, 1),
      provenance: term.provenance,
    });
  }

  return signals;
}

export function inferContentKind(title: string, sourceType: string) {
  const normalized = canonicalize(`${title} ${sourceType}`);

  if (normalized.includes("youtube")) {
    return "video";
  }
  if (normalized.includes("release")) {
    return "release";
  }
  if (normalized.includes("arxiv") || normalized.includes("paper")) {
    return "paper";
  }
  if (normalized.includes("benchmark") || normalized.includes("eval")) {
    return "benchmark";
  }

  return "article";
}

export function computeFreshness(publishedAt?: Date) {
  if (!publishedAt) {
    return 0.42;
  }

  const ageHours = (Date.now() - publishedAt.getTime()) / 36e5;
  return clamp(1 - ageHours / (24 * 21), 0.18, 1);
}

export function computeGlobalImportance(
  title: string,
  sourceType: string,
  tags: DomainTag[],
  trustScore: number,
) {
  const normalized = canonicalize(`${title} ${sourceType}`);
  let score = sourceType.includes("official") || sourceType.includes("release") ? 0.62 : 0.46;

  for (const term of HIGH_URGENCY_TERMS) {
    if (normalized.includes(canonicalize(term))) {
      score += 0.08;
    }
  }

  if (tags.some((tag) => tag.category === "company")) {
    score += 0.05;
  }
  if (tags.some((tag) => tag.label === "Benchmarks")) {
    score += 0.08;
  }
  if (tags.some((tag) => tag.label === "Pricing")) {
    score += 0.06;
  }

  return clamp(score * 0.72 + trustScore * 0.28, 0.18, 1);
}

export function computeActionability(title: string, summary: string, tags: DomainTag[]) {
  const normalized = canonicalize(`${title} ${summary}`);
  let score = 0.36;

  for (const term of ACTIONABILITY_TERMS) {
    if (normalized.includes(canonicalize(term))) {
      score += 0.11;
    }
  }

  if (tags.some((tag) => tag.label === "API")) {
    score += 0.06;
  }
  if (tags.some((tag) => tag.label === "Release Notes")) {
    score += 0.08;
  }

  return clamp(score, 0.12, 1);
}

export function buildFingerprint(...parts: Array<string | null | undefined>) {
  return createHash("sha1")
    .update(parts.filter(Boolean).join("::"))
    .digest("hex");
}

export function summarizeText(raw: string) {
  return truncate(
    raw
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    220,
  );
}

export function summarizeWhyShown(matches: TelemetrySignal[]) {
  if (!matches.length) {
    return "This surfaced because it is broadly important in the AI ecosystem.";
  }

  const top = matches
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((signal) => signal.label);

  return `This maps to your current work in ${top.join(", ")}.`;
}

export function summarizeWhyItMatters(
  title: string,
  summary: string,
  tags: DomainTag[],
) {
  const normalized = canonicalize(`${title} ${summary}`);

  if (normalized.includes("pricing")) {
    return "Pricing or packaging changes can shift whether a tool still belongs in your stack.";
  }
  if (normalized.includes("benchmark") || tags.some((tag) => tag.label === "Benchmarks")) {
    return "Benchmarks can change which model, framework, or workflow is worth evaluating next.";
  }
  if (normalized.includes("release")) {
    return "A release signal usually means new capabilities, migrations, or integration work worth checking quickly.";
  }
  if (tags.some((tag) => tag.category === "company")) {
    return "Major vendor moves often ripple into model quality, API behavior, and platform choices.";
  }

  return "This looks strategically relevant to how AI tooling and developer workflows are evolving.";
}

export function trustMultiplier(trustScore: number) {
  return clamp(0.75 + trustScore * 0.4, 0.75, 1.15);
}
