#!/usr/bin/env node
/**
 * 批量上传 Markdown 到 /api/upload/md（无需 Token / 用户）
 *
 * 用法：
 *   ORIGIN=https://dahuangshu.vip KIND=script node scripts/upload-md.mjs ./剧本目录
 *   ORIGIN=https://dahuangshu.vip KIND=novel node scripts/upload-md.mjs ./小说目录
 */
import fs from "node:fs";
import path from "node:path";

const origin = (process.env.ORIGIN || process.env.APP_ORIGIN || "http://127.0.0.1:3000").replace(/\/$/, "");
const kindRaw = String(process.env.KIND || "").trim().toLowerCase();
const kind = kindRaw === "novel" || kindRaw === "小说" ? "novel" : kindRaw === "script" || kindRaw === "短剧" || kindRaw === "剧本" ? "script" : "";


const inputs = process.argv.slice(2);
if (!inputs.length) {
  console.error("用法: node scripts/upload-md.mjs <文件或目录...>");
  process.exit(1);
}

function collect(entry, out = []) {
  const st = fs.statSync(entry);
  if (st.isDirectory()) {
    for (const name of fs.readdirSync(entry)) {
      collect(path.join(entry, name), out);
    }
  } else if (/\.(md|markdown|txt)$/i.test(entry)) {
    out.push(entry);
  }
  return out;
}

const files = inputs.flatMap((p) => collect(path.resolve(p)));
if (!files.length) {
  console.error("没有找到 .md / .markdown / .txt 文件");
  process.exit(1);
}

console.log(`上传 ${files.length} 个文件 → ${origin}/api/upload/md${kind ? `（${kind}）` : ""}`);

let ok = 0;
let fail = 0;
for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const body = { content };
  if (kind) body.kind = kind;
  const res = await fetch(`${origin}/api/upload/md`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.ok) {
    ok += 1;
    console.log(`OK  ${path.basename(file)} → #${data.workId} 《${data.title}》 ${data.url}`);
  } else {
    fail += 1;
    console.error(`FAIL ${path.basename(file)} → ${res.status} ${data.error || JSON.stringify(data)}`);
  }
}

console.log(`完成：成功 ${ok}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
