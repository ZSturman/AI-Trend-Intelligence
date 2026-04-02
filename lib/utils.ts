import { formatDistanceToNowStrict } from "date-fns";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function parseCsv(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function canonicalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function slugify(value: string) {
  return canonicalize(value).replace(/\s+/g, "-");
}

export function toTitleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function describeRelativeDate(date: Date | string | null | undefined) {
  if (!date) {
    return "Unknown time";
  }

  return `${formatDistanceToNowStrict(new Date(date), {
    addSuffix: true,
  })}`;
}

export function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function truncate(value: string, length = 180) {
  if (value.length <= length) {
    return value;
  }

  return `${value.slice(0, length - 1).trimEnd()}…`;
}

export function groupBy<T, K extends string | number>(
  items: T[],
  getter: (item: T) => K,
) {
  return items.reduce<Record<K, T[]>>((accumulator, item) => {
    const key = getter(item);
    accumulator[key] ??= [];
    accumulator[key].push(item);
    return accumulator;
  }, {} as Record<K, T[]>);
}
