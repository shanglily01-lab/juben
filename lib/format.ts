import type { Review } from "@/lib/types";

export function nowIso() {
  return new Date().toISOString();
}

export function shanghaiToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function previousDay(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, date));
  utc.setUTCDate(utc.getUTCDate() - 1);
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shortDay(day: string) {
  const [, month, date] = day.split("-");
  return `${Number(month)}/${Number(date)}`;
}

export function countWords(text: string) {
  const cjk = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const words = text.match(/[A-Za-z0-9]+/g)?.length ?? 0;
  return cjk + words;
}

export function kindLabel(kind: string) {
  return kind === "script" ? "短剧" : "小说";
}

export function priceLabel(price: number) {
  return price <= 0 ? "免费" : `${price} 金币`;
}

export function gradeOf(score: number) {
  if (score >= 9) return "甲上";
  if (score >= 8) return "甲";
  if (score >= 7) return "乙上";
  if (score >= 6) return "乙";
  return "未过";
}

export function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Shanghai",
  }).format(date);
}

export function previewMarkdown(markdown: string, limit = 380) {
  const clean = markdown.trim();
  if (clean.length <= limit) return clean;
  const slice = clean.slice(0, limit);
  const paragraph = slice.lastIndexOf("\n\n");
  const stop = slice.lastIndexOf("。");
  const cut = Math.max(paragraph, stop);
  if (cut >= 80) {
    const includeStop = slice[cut] === "。" ? 1 : 0;
    return slice.slice(0, cut + includeStop).trim();
  }
  return `${slice.trim()}……`;
}

export function parseReview(raw: string | null): Review | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Review;
    if (!data || typeof data.score !== "number" || !data.dimensions) return null;
    return data;
  } catch {
    return null;
  }
}

function unfoldPath(value: string) {
  let current = value;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let next = current;
    try {
      next = decodeURIComponent(current);
    } catch {
      return null;
    }
    if (next === current) return current;
    current = next;
  }
  return current;
}

export function safeMarkdownUrl(url: string) {
  const value = url.trim();
  if (!value) return "";
  if (value.startsWith("#") || value.startsWith("?")) return value;
  if (value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")) return value;
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "mailto:") return value;
  } catch {
    return "";
  }
  return "";
}

export function safeNext(value: string | null | undefined, fallback = "/") {
  if (!value) return fallback;
  const decoded = unfoldPath(value);
  if (!decoded) return fallback;
  if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.startsWith("/\\")) return fallback;
  if (decoded.includes("\\") || decoded.includes("://")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(decoded)) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export function browseHref(options: { kind?: string; category?: string; q?: string }) {
  const params = new URLSearchParams();
  if (options.kind === "script" || options.kind === "novel") params.set("kind", options.kind);
  if (options.category) params.set("category", options.category);
  if (options.q) params.set("q", options.q);
  const query = params.toString();
  return query ? `/browse?${query}` : "/browse";
}
