import fs from "node:fs";
import path from "node:path";

import { categoryName } from "@/lib/categories";
import { dataDir } from "@/lib/paths";
import type { Kind } from "@/lib/types";

export type CoverInput = {
  id: number;
  title: string;
  summary: string;
  category: string;
  kind: Kind;
  grade: string;
  content?: string;
};

const PALETTE: Record<string, [string, string, string]> = {
  suspense: ["#120f1f", "#4a3a7a", "#f0e0b8"],
  history: ["#24110c", "#9a452c", "#f2d4a8"],
  disaster: ["#0f151c", "#3f5a74", "#d5e4f0"],
  transmigration: ["#24101f", "#8f3f6c", "#f4cfe0"],
  romance: ["#241118", "#b04a5a", "#f7d4d0"],
  scifi: ["#06161c", "#15707a", "#d2f2f0"],
  urban: ["#1f160c", "#b87820", "#f4dfb0"],
  wuxia: ["#0b1f16", "#1f7a52", "#d2eee2"],
};

function hash(text: string) {
  let value = 0;
  for (const char of text) value = (value * 33 + char.codePointAt(0)!) >>> 0;
  return value;
}

function xml(text: string) {
  return text.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&apos;";
  });
}

function scene(text: string, deep: string, mid: string, paper: string, seed: number) {
  const parts: string[] = [];
  if (/雪|冬/.test(text)) {
    parts.push(
      Array.from({ length: 34 }, (_, index) => {
        const x = (seed + index * 47) % 600;
        const y = (seed + index * 83) % 620;
        return `<circle cx="${x}" cy="${y}" r="${index % 3 === 0 ? 2.4 : 1.2}" fill="#fff" opacity="0.78"/>`;
      }).join(""),
    );
  }
  if (/雨|夜|末班|凌晨/.test(text)) {
    parts.push(
      Array.from({ length: 22 }, (_, index) => {
        const x = 16 + ((seed + index * 34) % 560);
        const y = 24 + ((seed + index * 29) % 460);
        return `<line x1="${x}" y1="${y}" x2="${x - 12}" y2="${y + 34}" stroke="#d7e4ff" stroke-width="1.5" opacity="0.42"/>`;
      }).join(""),
    );
  }
  if (/楼|电梯|城|都市|避难|药房|写字楼/.test(text)) {
    parts.push(
      `<g fill="${deep}" opacity="0.62">
        <rect x="54" y="260" width="74" height="300"/>
        <rect x="148" y="180" width="96" height="380"/>
        <rect x="268" y="230" width="58" height="330"/>
        <rect x="360" y="140" width="128" height="420"/>
        <rect x="508" y="280" width="62" height="280"/>
      </g>
      <g fill="${paper}" opacity="0.88">
        <rect x="172" y="214" width="14" height="18"/><rect x="206" y="254" width="14" height="18"/>
        <rect x="172" y="316" width="14" height="18"/><rect x="388" y="188" width="16" height="22"/>
        <rect x="430" y="248" width="16" height="22"/><rect x="388" y="332" width="16" height="22"/>
        <rect x="430" y="392" width="16" height="22"/>
      </g>`,
    );
  }
  if (/车|轨|站|地铁/.test(text)) {
    parts.push(
      `<g fill="none" stroke="${deep}" stroke-width="9" opacity="0.72">
        <path d="M20 560 C180 490 290 540 580 460"/>
        <path d="M20 596 C210 526 330 576 580 496"/>
      </g>
      <rect x="236" y="430" width="168" height="78" rx="10" fill="${deep}" opacity="0.86"/>
      <rect x="250" y="444" width="46" height="28" rx="3" fill="${paper}" opacity="0.55"/>
      <rect x="306" y="444" width="46" height="28" rx="3" fill="${paper}" opacity="0.55"/>
      <circle cx="276" cy="514" r="13" fill="#120c08"/><circle cx="364" cy="514" r="13" fill="#120c08"/>`,
    );
  }
  if (/剑|刀|江湖|武|剑谱/.test(text)) {
    parts.push(
      `<g transform="translate(410 150) rotate(16)" fill="${deep}">
        <rect x="0" y="0" width="18" height="280" rx="2"/>
        <rect x="-22" y="276" width="62" height="12"/>
        <rect x="5" y="288" width="8" height="52"/>
      </g>
      <path d="M90 540 Q180 470 270 540 T450 540" fill="none" stroke="${mid}" stroke-width="3" opacity="0.45"/>`,
    );
  }
  if (/灯|烛|火|钥匙/.test(text)) {
    parts.push(
      `<g transform="translate(96 340)">
        <rect x="18" y="48" width="10" height="140" fill="${deep}"/>
        <ellipse cx="23" cy="30" rx="18" ry="26" fill="#f0b429"/>
        <ellipse cx="23" cy="32" rx="8" ry="14" fill="#fff6d8"/>
      </g>
      <path d="M40 620 H560" stroke="${paper}" stroke-width="2" opacity="0.25"/>`,
    );
  }
  if (/海|船|浪|深空|舱/.test(text)) {
    parts.push(
      `<ellipse cx="470" cy="160" rx="70" ry="28" fill="${paper}" opacity="0.18"/>
       <path d="M0 510 Q90 470 180 510 T360 510 T540 510 T720 510 V640 H0 Z" fill="${deep}" opacity="0.38"/>
       <path d="M0 560 Q100 520 200 560 T400 560 T600 560 V660 H0 Z" fill="${deep}" opacity="0.55"/>`,
    );
  }
  if (/宫|王|朝|状元|呈词|钦差|轿/.test(text)) {
    parts.push(
      `<path d="M70 420 L300 280 L530 420 V470 H70 Z" fill="${deep}" opacity="0.78"/>
       <rect x="140" y="470" width="320" height="110" fill="${deep}" opacity="0.58"/>
       <rect x="250" y="500" width="100" height="80" fill="${mid}" opacity="0.5"/>`,
    );
  }
  if (/药|雨|封城|广播/.test(text) && !/楼|电梯|城/.test(text)) {
    parts.push(
      `<path d="M0 420 Q150 360 300 430 T600 400 V640 H0 Z" fill="${deep}" opacity="0.35"/>
       <rect x="250" y="360" width="100" height="160" rx="8" fill="${deep}" opacity="0.7"/>
       <rect x="270" y="390" width="60" height="20" fill="${paper}" opacity="0.5"/>`,
    );
  }
  if (parts.length === 0) {
    parts.push(
      `<path d="M30 540 L130 390 L230 540 Z" fill="${deep}" opacity="0.42"/>
       <path d="M180 560 L320 320 L470 560 Z" fill="${deep}" opacity="0.58"/>
       <path d="M400 520 L510 380 L590 520 Z" fill="${deep}" opacity="0.4"/>`,
    );
  }
  return parts.join("");
}

export function renderCoverSvg(input: Omit<CoverInput, "id">) {
  const [deep, mid, paper] = PALETTE[input.category] ?? PALETTE.urban;
  const text = `${input.title} ${input.summary} ${input.content?.slice(0, 200) ?? ""}`;
  const seed = hash(input.title);
  const moonX = 70 + (seed % 430);
  const hook = input.summary.replace(/\s+/g, " ").slice(0, 40);
  const kind = input.kind === "script" ? "短剧" : "小说";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0" stop-color="${mid}"/>
      <stop offset="0.55" stop-color="${deep}"/>
      <stop offset="1" stop-color="#050308"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="28%" r="45%">
      <stop offset="0" stop-color="${paper}" stop-opacity="0.22"/>
      <stop offset="1" stop-color="${paper}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="600" height="840" fill="url(#sky)"/>
  <rect width="600" height="840" fill="url(#glow)"/>
  <circle cx="${moonX}" cy="118" r="46" fill="${paper}" opacity="0.92"/>
  <circle cx="${moonX + 18}" cy="108" r="38" fill="${mid}" opacity="0.95"/>
  ${scene(text, deep, mid, paper, seed)}
  <ellipse cx="300" cy="780" rx="260" ry="34" fill="#000" opacity="0.32"/>
  <g transform="translate(286 560)" fill="#100c08">
    <circle cx="20" cy="0" r="17"/>
    <path d="M2 24 h36 l10 92 h-16 l-8 -46 l-10 46 h-16 z"/>
  </g>
  <title>${xml(input.title)}</title>
  <desc>${xml(kind)} ${xml(categoryName(input.category))} ${xml(hook)}</desc>
</svg>`;
}

function coverDir() {
  return path.join(dataDir(), "covers");
}

export function coverPaths(id: number) {
  const dir = coverDir();
  return { dir, png: path.join(dir, `${id}.png`), svg: path.join(dir, `${id}.svg`) };
}

/** 从简介 + 正文抽出封面用的主剧情提示（不要书名水印）。 */
export function promptFor(input: CoverInput) {
  const raw = (input.content ?? "").replace(/\s+/g, " ").trim();
  const beats = raw
    .split(/(?<=[。！？\n])/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 8)
    .slice(0, 4)
    .join("");
  const plot = (input.summary || beats || input.title).replace(/\s+/g, " ").slice(0, 360);
  const scene = (beats || raw).slice(0, 420);
  return [
    "Vertical cinematic movie poster, photorealistic, no text, no letters, no watermark, no logo, no title.",
    `Genre: ${categoryName(input.category)} short drama.`,
    `Story premise: ${plot}`,
    scene ? `Key scene to depict: ${scene}` : "",
    "Show one clear dramatic moment with readable characters, strong lighting, and environmental detail.",
  ]
    .filter(Boolean)
    .join(" ");
}

function imageConfig() {
  const model = process.env.AI_IMAGE_MODEL?.trim() || "";
  const apiKey = (process.env.AI_IMAGE_API_KEY || process.env.AI_API_KEY)?.trim() || "";
  const base = (
    process.env.AI_IMAGE_BASE_URL?.trim() ||
    process.env.AI_BASE_URL?.trim() ||
    "https://api.siliconflow.cn/v1"
  ).replace(/\/$/, "");
  const size = process.env.AI_IMAGE_SIZE?.trim() || "768x1024";
  return { model, apiKey, base, size };
}

async function downloadImageBytes(url: string) {
  const file = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!file.ok) return undefined;
  const bytes = Buffer.from(await file.arrayBuffer());
  return bytes.length >= 32 ? bytes : undefined;
}

type ImageApiPayload = {
  data?: { b64_json?: string; url?: string }[];
  images?: { b64_json?: string; url?: string }[];
};

async function requestCoverImage(base: string, apiKey: string, model: string, prompt: string, size: string) {
  const bodies: Record<string, unknown>[] = [
    // SiliconFlow / 多数兼容接口
    { model, prompt, image_size: size, num_inference_steps: 20 },
    // OpenAI 风格
    { model, prompt, size, n: 1 },
  ];
  for (const body of bodies) {
    const response = await fetch(`${base}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) continue;
    const payload = (await response.json()) as ImageApiPayload;
    const first = payload.data?.[0] || payload.images?.[0];
    if (!first) continue;
    if (first.b64_json) {
      const bytes = Buffer.from(first.b64_json, "base64");
      if (bytes.length >= 32) return bytes;
    }
    if (first.url) {
      const bytes = await downloadImageBytes(first.url);
      if (bytes) return bytes;
    }
  }
  return undefined;
}

async function tryImage(input: CoverInput) {
  const { model, apiKey, base, size } = imageConfig();
  if (!apiKey || !model) return false;
  try {
    const bytes = await requestCoverImage(base, apiKey, model, promptFor(input), size);
    if (!bytes) return false;
    const { dir, png, svg } = coverPaths(input.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(png, bytes);
    fs.rmSync(svg, { force: true });
    return true;
  } catch {
    return false;
  }
}

export function ensureSvgCover(input: CoverInput, force = false) {
  const { dir, png, svg } = coverPaths(input.id);
  if (!force && (fs.existsSync(png) || fs.existsSync(svg))) return;
  fs.mkdirSync(dir, { recursive: true });
  fs.rmSync(png, { force: true });
  fs.writeFileSync(svg, renderCoverSvg(input));
}

export async function createReviewCover(input: CoverInput) {
  const { png, svg } = coverPaths(input.id);
  fs.rmSync(png, { force: true });
  fs.rmSync(svg, { force: true });
  if (await tryImage(input)) return;
  ensureSvgCover(input, true);
}

export function readCover(id: number) {
  const { png, svg } = coverPaths(id);
  if (fs.existsSync(png)) return { body: fs.readFileSync(png), type: "image/png" };
  if (fs.existsSync(svg)) return { body: fs.readFileSync(svg), type: "image/svg+xml" };
  return undefined;
}
