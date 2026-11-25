/**
 * 给还没有封面的已上架作品补 SVG 模板（可选再跑 AI）。
 * 用法（服务器上）：
 *   cd /opt/dahuangshu && sudo -u dahuangshu node scripts/backfill-covers.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";

const require = createRequire(import.meta.url);
const dataDir = process.env.MOBEN_DATA_DIR || path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "moben.sqlite");
const coverDir = path.join(dataDir, "covers");

if (!fs.existsSync(dbPath)) {
  console.error("找不到数据库", dbPath);
  process.exit(1);
}

fs.mkdirSync(coverDir, { recursive: true });
const db = new DatabaseSync(dbPath);
const rows = db.prepare("SELECT id, title, summary, category, kind, grade FROM works WHERE status = 'published'").all();

let made = 0;
for (const row of rows) {
  const png = path.join(coverDir, `${row.id}.png`);
  const svg = path.join(coverDir, `${row.id}.svg`);
  if (fs.existsSync(png) || fs.existsSync(svg)) continue;
  const title = escapeXml(row.title || "短剧");
  const summary = escapeXml((row.summary || "").slice(0, 80));
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
  <rect width="600" height="840" fill="#1f160c"/>
  <rect x="24" y="24" width="552" height="792" fill="none" stroke="#f0b429" stroke-width="3"/>
  <text x="48" y="120" fill="#f4dfb0" font-size="36" font-family="serif">${title}</text>
  <foreignObject x="48" y="160" width="504" height="200">
    <div xmlns="http://www.w3.org/1999/xhtml" style="color:#d5c4a1;font:18px sans-serif;line-height:1.5">${summary}</div>
  </foreignObject>
</svg>`;
  fs.writeFileSync(svg, body);
  made += 1;
  console.log("cover", row.id, row.title);
}

console.log(`done: created ${made}, scanned ${rows.length}`);

function escapeXml(text) {
  return String(text).replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[ch],
  );
}
