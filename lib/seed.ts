import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

import { reviewLocal } from "@/lib/ai";
import { isCategory } from "@/lib/categories";
import { countWords, nowIso } from "@/lib/format";
import { hashPassword } from "@/lib/password";
import type { Kind } from "@/lib/types";

export type SeedWork = {
  title: string;
  kind: Kind;
  category: string;
  price: number;
  summary: string;
  content: string;
  file: string;
};

function field(block: string, key: string, file: string) {
  const line = block.split(/\r?\n/).find((item) => item.startsWith(`${key}:`));
  if (!line) throw new Error(`${file} 缺少 ${key}`);
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
}

export function readSeedWorks(): SeedWork[] {
  const dir = path.join(process.cwd(), "content", "seed");
  if (!fs.existsSync(dir)) throw new Error("找不到 content/seed，编辑室稿件还没放进来");
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => {
      const raw = fs.readFileSync(path.join(dir, file), "utf8").replace(/^\uFEFF/, "");
      const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
      if (!match) throw new Error(`${file} 缺少 frontmatter`);
      const kind = field(match[1], "kind", file);
      const category = field(match[1], "category", file);
      const price = Number(field(match[1], "price", file));
      if (kind !== "script" && kind !== "novel") throw new Error(`${file} 的 kind 无效`);
      if (!isCategory(category)) throw new Error(`${file} 的分类无效`);
      if (!Number.isInteger(price) || price < 0 || price > 99) throw new Error(`${file} 的定价无效`);
      const content = match[2].trim();
      return {
        file,
        title: field(match[1], "title", file),
        kind,
        category,
        price,
        summary: field(match[1], "summary", file),
        content,
      };
    });
}

export function seedIfEmpty(db: DatabaseSync) {
  const existing = db.prepare("SELECT COUNT(*) AS c FROM works").get() as { c: number };
  if (existing.c > 0) return;

  const works = readSeedWorks();
  const now = nowIso();
  db.exec("BEGIN IMMEDIATE");
  try {
    const existingAuthor = db.prepare("SELECT id FROM users WHERE username = ?").get("墨本编辑室") as
      | { id: number }
      | undefined;
    let authorId = existingAuthor?.id ?? 0;
    if (!authorId) {
      const passwordHash = hashPassword(randomBytes(24).toString("hex"));
      const author = db
        .prepare(
          "INSERT INTO users (username, email, password_hash, coins, created_at, email_verified_at) VALUES (?, ?, ?, 0, ?, ?)",
        )
        .run("墨本编辑室", "editor@moben.local", passwordHash, now, now);
      authorId = Number(author.lastInsertRowid);
    }
    const insert = db.prepare(
      `INSERT INTO works (
        title, kind, category, summary, content, author_id, price, status, score, grade,
        review_json, review_source, word_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const work of works) {
      const review = reviewLocal(work);
      insert.run(
        work.title,
        work.kind,
        work.category,
        work.summary,
        work.content,
        authorId,
        work.price,
        review.decision === "approve" ? "published" : "rejected",
        review.score,
        review.grade,
        JSON.stringify(review),
        review.source,
        countWords(work.content),
        now,
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw error;
  }
}
