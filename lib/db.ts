import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { isCategory } from "@/lib/categories";
import { makeInviteCode } from "@/lib/codes";
import { INVITEE_COINS, INVITER_COINS, SIGNUP_COINS, checkinReward } from "@/lib/coins";
import { splitEpisodes } from "@/lib/episodes";
import { BUYOUT_COINS, BUYOUT_YUAN } from "@/lib/pricing";
import { nowIso, previousDay, shanghaiToday } from "@/lib/format";
import { dataDir } from "@/lib/paths";
import { seedIfEmpty } from "@/lib/seed";
import type { Kind, PublicWork, Review } from "@/lib/types";

type UserRow = {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  coins: number;
  created_at: string;
  invite_code: string | null;
  invited_by: number | null;
  email_verified_at: string | null;
  buyout_at: string | null;
};

type PayOrderRow = {
  id: number;
  mch_order_no: string;
  user_id: number;
  kind: string;
  work_id: number | null;
  requirement_id: number | null;
  amount_fen: number;
  status: string;
  pay_url: string | null;
  serial_order_no: string | null;
  created_at: string;
  paid_at: string | null;
};

export type RequirementRow = {
  id: number;
  user_id: number;
  title: string;
  kind: Kind;
  category: string;
  brief: string;
  reference_text: string;
  bounty_yuan: number;
  status: string;
  delivered_work_id: number | null;
  created_at: string;
  paid_at: string | null;
  delivered_at: string | null;
  username?: string;
};

type WorkRow = {
  id: number;
  title: string;
  kind: Kind;
  category: string;
  summary: string;
  content: string;
  author_id: number;
  price: number;
  status: string;
  score: number;
  grade: string;
  review_json: string;
  review_source: string;
  word_count: number;
  created_at: string;
  buyout_user_id: number | null;
  buyout_at: string | null;
  read_count: number;
  purchase_count: number;
  episode_count: number;
  author?: string;
};

type LedgerRow = {
  id: number;
  user_id: number;
  delta: number;
  reason: string;
  created_at: string;
};

type CheckinRow = {
  id: number;
  user_id: number;
  day: string;
  streak: number;
  coins: number;
  created_at: string;
};

const globalDb = globalThis as unknown as { __moben?: DatabaseSync; __mobenSchema?: number };
const SCHEMA = 16;
const ACTIVATION_MS = 24 * 60 * 60 * 1000;
const RESEND_MS = 60 * 1000;

function columnNames(db: DatabaseSync, table: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return new Set(rows.map((row) => row.name));
}

function migrate(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      coins INTEGER NOT NULL DEFAULT 0 CHECK (coins >= 0),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS works (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      kind TEXT NOT NULL,
      category TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      author_id INTEGER NOT NULL,
      price INTEGER NOT NULL,
      status TEXT NOT NULL,
      score REAL NOT NULL,
      grade TEXT NOT NULL,
      review_json TEXT NOT NULL,
      review_source TEXT NOT NULL,
      word_count INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (author_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS unlocks (
      user_id INTEGER NOT NULL,
      work_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      buyout INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, work_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (work_id) REFERENCES works(id)
    );
    CREATE TABLE IF NOT EXISTS ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      streak INTEGER NOT NULL,
      coins INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (user_id, day),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_works_list ON works(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_works_author ON works(author_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_checkins_user ON checkins(user_id, day);
    CREATE TABLE IF NOT EXISTS email_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens(user_id, id);
    CREATE TABLE IF NOT EXISTS pay_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mch_order_no TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      work_id INTEGER,
      amount_fen INTEGER NOT NULL,
      status TEXT NOT NULL,
      pay_url TEXT,
      serial_order_no TEXT,
      created_at TEXT NOT NULL,
      paid_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (work_id) REFERENCES works(id)
    );
    CREATE INDEX IF NOT EXISTS idx_pay_orders_user ON pay_orders(user_id, id);
    CREATE TABLE IF NOT EXISTS requirements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      kind TEXT NOT NULL,
      category TEXT NOT NULL,
      brief TEXT NOT NULL,
      reference_text TEXT NOT NULL DEFAULT '',
      bounty_yuan INTEGER NOT NULL,
      status TEXT NOT NULL,
      delivered_work_id INTEGER,
      created_at TEXT NOT NULL,
      paid_at TEXT,
      delivered_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (delivered_work_id) REFERENCES works(id)
    );
    CREATE INDEX IF NOT EXISTS idx_requirements_status ON requirements(status, id DESC);
    CREATE INDEX IF NOT EXISTS idx_requirements_user ON requirements(user_id, id DESC);
    CREATE TABLE IF NOT EXISTS discussions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      work_id INTEGER,
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (work_id) REFERENCES works(id)
    );
    CREATE INDEX IF NOT EXISTS idx_discussions_work ON discussions(work_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_discussions_recent ON discussions(id DESC);
  `);
  const userColumns = columnNames(db, "users");
  if (!userColumns.has("invite_code")) db.exec("ALTER TABLE users ADD COLUMN invite_code TEXT");
  if (!userColumns.has("invited_by")) db.exec("ALTER TABLE users ADD COLUMN invited_by INTEGER");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_invite_code ON users(invite_code)");
  if (!userColumns.has("email_verified_at")) {
    db.exec("ALTER TABLE users ADD COLUMN email_verified_at TEXT");
    db.exec("UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL");
  }
  if (!userColumns.has("buyout_at")) db.exec("ALTER TABLE users ADD COLUMN buyout_at TEXT");
  const unlockColumns = columnNames(db, "unlocks");
  if (!unlockColumns.has("buyout")) {
    db.exec("ALTER TABLE unlocks ADD COLUMN buyout INTEGER NOT NULL DEFAULT 0");
  }
  const workColumns = columnNames(db, "works");
  if (!workColumns.has("buyout_user_id")) db.exec("ALTER TABLE works ADD COLUMN buyout_user_id INTEGER");
  if (!workColumns.has("buyout_at")) db.exec("ALTER TABLE works ADD COLUMN buyout_at TEXT");
  if (!workColumns.has("read_count")) {
    db.exec("ALTER TABLE works ADD COLUMN read_count INTEGER NOT NULL DEFAULT 0");
  }
  if (!workColumns.has("purchase_count")) {
    db.exec("ALTER TABLE works ADD COLUMN purchase_count INTEGER NOT NULL DEFAULT 0");
    db.exec(`
      UPDATE works
      SET purchase_count = COALESCE((
        SELECT COUNT(*) FROM unlocks ul WHERE ul.work_id = works.id
      ), 0)
    `);
  }
  if (!workColumns.has("episode_count")) {
    db.exec("ALTER TABLE works ADD COLUMN episode_count INTEGER NOT NULL DEFAULT 1");
    const rows = db.prepare("SELECT id, content FROM works").all() as { id: number; content: string }[];
    const updateEp = db.prepare("UPDATE works SET episode_count = ? WHERE id = ?");
    for (const row of rows) {
      updateEp.run(Math.max(1, splitEpisodes(row.content || "").length), row.id);
    }
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_works_hot ON works(status, read_count, score)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_works_buy ON works(status, purchase_count, score)");
  const payColumns = columnNames(db, "pay_orders");
  if (!payColumns.has("requirement_id")) {
    db.exec("ALTER TABLE pay_orders ADD COLUMN requirement_id INTEGER");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS requirements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      kind TEXT NOT NULL,
      category TEXT NOT NULL,
      brief TEXT NOT NULL,
      reference_text TEXT NOT NULL DEFAULT '',
      bounty_yuan INTEGER NOT NULL,
      status TEXT NOT NULL,
      delivered_work_id INTEGER,
      created_at TEXT NOT NULL,
      paid_at TEXT,
      delivered_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (delivered_work_id) REFERENCES works(id)
    );
    CREATE INDEX IF NOT EXISTS idx_requirements_status ON requirements(status, id DESC);
    CREATE INDEX IF NOT EXISTS idx_requirements_user ON requirements(user_id, id DESC);
    CREATE TABLE IF NOT EXISTS discussions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      work_id INTEGER,
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (work_id) REFERENCES works(id)
    );
    CREATE INDEX IF NOT EXISTS idx_discussions_work ON discussions(work_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_discussions_recent ON discussions(id DESC);
  `);
  // 下线全部小说：关联记录清掉后再删作品
  db.exec(`
    DELETE FROM discussions WHERE work_id IN (SELECT id FROM works WHERE kind = 'novel');
    DELETE FROM unlocks WHERE work_id IN (SELECT id FROM works WHERE kind = 'novel');
    UPDATE pay_orders SET work_id = NULL WHERE work_id IN (SELECT id FROM works WHERE kind = 'novel');
    UPDATE requirements SET delivered_work_id = NULL WHERE delivered_work_id IN (SELECT id FROM works WHERE kind = 'novel');
    DELETE FROM works WHERE kind = 'novel';
  `);
  db.exec("UPDATE users SET username = '大黄叔' WHERE username = '墨本编辑室'");
  const editorNameTaken = db
    .prepare("SELECT id FROM users WHERE username = '大黄书' AND email != 'editor@moben.local'")
    .get();
  if (!editorNameTaken) {
    db.prepare("UPDATE users SET username = '大黄书' WHERE email = 'editor@moben.local'").run();
  }

  // 清掉编辑室历史样本。
  db.exec(`
    DELETE FROM discussions WHERE work_id IN (
      SELECT id FROM works WHERE author_id IN (SELECT id FROM users WHERE email = 'editor@moben.local')
    );
    DELETE FROM unlocks WHERE work_id IN (
      SELECT id FROM works WHERE author_id IN (SELECT id FROM users WHERE email = 'editor@moben.local')
    );
    UPDATE pay_orders SET work_id = NULL WHERE work_id IN (
      SELECT id FROM works WHERE author_id IN (SELECT id FROM users WHERE email = 'editor@moben.local')
    );
    UPDATE requirements SET delivered_work_id = NULL WHERE delivered_work_id IN (
      SELECT id FROM works WHERE author_id IN (SELECT id FROM users WHERE email = 'editor@moben.local')
    );
    DELETE FROM works WHERE author_id IN (SELECT id FROM users WHERE email = 'editor@moben.local');
  `);

  // SCHEMA 16：把「待审」稿直接上架，方便批量上传。
  db.exec(`
    UPDATE works
    SET status = 'published',
        score = CASE WHEN score < 6 THEN 6.5 ELSE score END,
        grade = CASE WHEN grade IN ('待审', '未过', '') OR grade IS NULL THEN '乙' ELSE grade END
    WHERE status = 'pending';
  `);
}

function freshInviteCode(db: DatabaseSync) {
  const taken = db.prepare("SELECT 1 AS ok FROM users WHERE invite_code = ?");
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = makeInviteCode();
    if (!taken.get(code)) return code;
  }
  throw new Error("邀请码没有生成成功");
}

function backfillInviteCodes(db: DatabaseSync) {
  const missing = db.prepare("SELECT id FROM users WHERE invite_code IS NULL OR invite_code = ''").all() as {
    id: number;
  }[];
  const update = db.prepare("UPDATE users SET invite_code = ? WHERE id = ?");
  for (const row of missing) update.run(freshInviteCode(db), row.id);
}

export function getDb() {
  if (!globalDb.__moben) {
    const dir = dataDir();
    fs.mkdirSync(dir, { recursive: true });
    const db = new DatabaseSync(path.join(dir, "moben.sqlite"));
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
    db.exec("PRAGMA busy_timeout = 3000");
    globalDb.__moben = db;
  }
  if (globalDb.__mobenSchema !== SCHEMA) {
    migrate(globalDb.__moben);
    seedIfEmpty(globalDb.__moben);
    backfillInviteCodes(globalDb.__moben);
    globalDb.__mobenSchema = SCHEMA;
  }
  return globalDb.__moben;
}

function one<T>(sql: string, ...params: unknown[]) {
  return getDb().prepare(sql).get(...params) as T | undefined;
}

function many<T>(sql: string, ...params: unknown[]) {
  return getDb().prepare(sql).all(...params) as T[];
}

function txn<T>(fn: (db: DatabaseSync) => T) {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn(db);
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* already closed */
    }
    throw error;
  }
}

const WORK_CARD = `
  SELECT w.id, w.title, w.kind, w.category, w.summary, w.price, w.score, w.grade,
         w.word_count, w.created_at, w.status, w.buyout_user_id, w.buyout_at,
         COALESCE(w.read_count, 0) AS read_count,
         COALESCE(w.purchase_count, 0) AS purchase_count,
         COALESCE(w.episode_count, 1) AS episode_count,
         u.username AS author
  FROM works w
  JOIN users u ON u.id = w.author_id
`;

function toPublic(row: WorkRow): PublicWork {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    category: row.category,
    summary: row.summary,
    price: row.price,
    score: row.score,
    grade: row.grade,
    wordCount: row.word_count,
    createdAt: row.created_at,
    author: row.author ?? "",
    status: row.status,
    buyoutTaken: Boolean(row.buyout_user_id),
    readCount: Number(row.read_count) || 0,
    purchaseCount: Number(row.purchase_count) || 0,
    episodeCount: Math.max(1, Number(row.episode_count) || 1),
  };
}

export function findUserById(id: number) {
  return one<UserRow>("SELECT * FROM users WHERE id = ?", id);
}

export function findUserByLogin(login: string) {
  return one<UserRow>("SELECT * FROM users WHERE username = ? OR email = ?", login, login.toLowerCase());
}

export function findUserByEmail(email: string) {
  return one<UserRow>("SELECT * FROM users WHERE email = ?", email.toLowerCase());
}

export function countWorksByAuthor(authorId: number) {
  const row = one<{ c: number }>("SELECT COUNT(*) AS c FROM works WHERE author_id = ?", authorId);
  return row?.c ?? 0;
}

export class InvalidInviteError extends Error {
  constructor() {
    super("邀请码不存在");
  }
}

export function registerUser(input: {
  username: string;
  email: string;
  passwordHash: string;
  inviteCode?: string;
}) {
  const now = nowIso();
  return txn((db) => {
    let inviter: { id: number; username: string } | undefined;
    if (input.inviteCode) {
      inviter = db
        .prepare(
          "SELECT id, username FROM users WHERE invite_code = ? AND email_verified_at IS NOT NULL",
        )
        .get(input.inviteCode) as { id: number; username: string } | undefined;
      if (!inviter) throw new InvalidInviteError();
    }
    const info = db
      .prepare(
        `INSERT INTO users (username, email, password_hash, coins, created_at, invite_code, invited_by)
         VALUES (?, ?, ?, 0, ?, ?, ?)`,
      )
      .run(input.username, input.email, input.passwordHash, now, freshInviteCode(db), inviter?.id ?? null);
    return Number(info.lastInsertRowid);
  });
}

export function listWorks(filter: { kind?: string; category?: string; q?: string; limit?: number }) {
  const where = ["w.status = 'published'"];
  const params: unknown[] = [];
  if (filter.kind === "novel") {
    return [];
  }
  // 小说已下线，书库只出短剧
  where.push("w.kind = 'script'");
  if (filter.category && isCategory(filter.category)) {
    where.push("w.category = ?");
    params.push(filter.category);
  }
  const q = filter.q?.trim();
  if (q) {
    where.push(
      "(w.title LIKE ? ESCAPE '\\' OR w.summary LIKE ? ESCAPE '\\' OR u.username LIKE ? ESCAPE '\\')",
    );
    const pattern = `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    params.push(pattern, pattern, pattern);
  }
  const limit = Math.min(Math.max(filter.limit ?? 48, 1), 60);
  const rows = many<WorkRow>(
    `${WORK_CARD} WHERE ${where.join(" AND ")} ORDER BY w.created_at DESC, w.id DESC LIMIT ${limit}`,
    ...params,
  );
  return rows.map(toPublic);
}

export function featuredWork() {
  const row = one<WorkRow>(
    `${WORK_CARD} WHERE w.status = 'published' AND w.kind = 'script' ORDER BY w.score DESC, w.id DESC LIMIT 1`,
  );
  return row ? toPublic(row) : undefined;
}

/** 打开作品页时记一次阅读。 */
export function recordWorkView(workId: number) {
  getDb()
    .prepare("UPDATE works SET read_count = COALESCE(read_count, 0) + 1 WHERE id = ? AND status = 'published'")
    .run(workId);
}

/** 热度排行：阅读次数优先，同分看评分。 */
export function listHotWorks(limit = 10) {
  const size = Math.min(Math.max(limit, 1), 40);
  return many<WorkRow>(
    `${WORK_CARD} WHERE w.status = 'published' AND w.kind = 'script'
     ORDER BY COALESCE(w.read_count, 0) DESC, w.score DESC, w.id DESC
     LIMIT ${size}`,
  ).map(toPublic);
}

/** 阅读推荐：热度与评分加权。 */
export function listRecommendedWorks(input?: { limit?: number; excludeId?: number; category?: string }) {
  const size = Math.min(Math.max(input?.limit ?? 8, 1), 24);
  const where = ["w.status = 'published'", "w.kind = 'script'"];
  const params: unknown[] = [];
  if (input?.excludeId) {
    where.push("w.id != ?");
    params.push(input.excludeId);
  }
  if (input?.category && isCategory(input.category)) {
    where.push("w.category = ?");
    params.push(input.category);
  }
  return many<WorkRow>(
    `${WORK_CARD} WHERE ${where.join(" AND ")}
     ORDER BY (COALESCE(w.read_count, 0) + w.score * 20) DESC, w.id DESC
     LIMIT ${size}`,
    ...params,
  ).map(toPublic);
}

/** 热购榜：购买 / 买断次数。 */
export function listHotPurchaseWorks(limit = 10) {
  const size = Math.min(Math.max(limit, 1), 40);
  return many<WorkRow>(
    `${WORK_CARD} WHERE w.status = 'published' AND w.kind = 'script'
     ORDER BY COALESCE(w.purchase_count, 0) DESC, w.score DESC, w.id DESC
     LIMIT ${size}`,
  ).map(toPublic);
}

/** 推荐榜：以审核评分为主，阅读与购买为辅。 */
export function listRecommendRankWorks(limit = 10) {
  const size = Math.min(Math.max(limit, 1), 40);
  return many<WorkRow>(
    `${WORK_CARD} WHERE w.status = 'published' AND w.kind = 'script'
     ORDER BY w.score DESC,
              (COALESCE(w.read_count, 0) + COALESCE(w.purchase_count, 0) * 5) DESC,
              w.id DESC
     LIMIT ${size}`,
  ).map(toPublic);
}

export function getWorkDetail(id: number) {
  return one<WorkRow & { author: string }>(
    `SELECT w.*, u.username AS author
     FROM works w JOIN users u ON u.id = w.author_id
     WHERE w.id = ?`,
    id,
  );
}

export function listByAuthor(authorId: number) {
  return many<WorkRow>(
    `${WORK_CARD} WHERE w.author_id = ? ORDER BY w.created_at DESC`,
    authorId,
  ).map(toPublic);
}

/** 仅作者可删未过审稿；已上架不可删。 */
export function deleteRejectedWork(workId: number, userId: number) {
  return txn((db) => {
    const work = db.prepare("SELECT id, author_id, status FROM works WHERE id = ?").get(workId) as
      | { id: number; author_id: number; status: string }
      | undefined;
    if (!work) return { ok: false as const, error: "找不到这篇" };
    if (work.author_id !== userId) return { ok: false as const, error: "只能删除自己的稿" };
    if (work.status === "published") return { ok: false as const, error: "已上架的稿不能删除" };

    db.prepare("DELETE FROM discussions WHERE work_id = ?").run(workId);
    db.prepare("DELETE FROM unlocks WHERE work_id = ?").run(workId);
    db.prepare("UPDATE pay_orders SET work_id = NULL WHERE work_id = ?").run(workId);
    db.prepare("UPDATE requirements SET delivered_work_id = NULL WHERE delivered_work_id = ?").run(workId);
    db.prepare("DELETE FROM works WHERE id = ?").run(workId);
    return { ok: true as const };
  });
}

export function listUnlocked(userId: number) {
  return many<WorkRow>(
    `${WORK_CARD}
     JOIN unlocks ul ON ul.work_id = w.id
     WHERE ul.user_id = ? AND w.status = 'published'
     ORDER BY ul.created_at DESC`,
    userId,
  ).map(toPublic);
}

export function hasUnlock(userId: number, workId: number) {
  return Boolean(one("SELECT 1 AS ok FROM unlocks WHERE user_id = ? AND work_id = ?", userId, workId));
}

export class WorkLimitError extends Error {
  constructor() {
    super("每人最多保存 50 篇稿件");
  }
}

export function insertWork(input: {
  title: string;
  kind: Kind;
  category: string;
  summary: string;
  content: string;
  authorId: number;
  price: number;
  review: Review;
  wordCount: number;
  /** pending=先入库待审；默认按审核结果上架或拒稿 */
  status?: "published" | "rejected" | "pending";
}) {
  const now = nowIso();
  return txn((db) => {
    const count = db.prepare("SELECT COUNT(*) AS c FROM works WHERE author_id = ?").get(input.authorId) as {
      c: number;
    };
    if (count.c >= 50) throw new WorkLimitError();
    const episodeCount = Math.max(1, splitEpisodes(input.content).length);
    const status =
      input.status || (input.review.decision === "approve" ? "published" : "rejected");
    const info = db
      .prepare(
        `INSERT INTO works (
          title, kind, category, summary, content, author_id, price, status, score, grade,
          review_json, review_source, word_count, episode_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.title,
        input.kind,
        input.category,
        input.summary,
        input.content,
        input.authorId,
        input.price,
        status,
        input.review.score,
        input.review.grade,
        JSON.stringify(input.review),
        input.review.source,
        input.wordCount,
        episodeCount,
        now,
      );
    return Number(info.lastInsertRowid);
  });
}

export function unlockWork(userId: number, workId: number, coins: number, title: string) {
  const now = nowIso();
  const cost = Math.max(0, Math.floor(coins));
  return txn((db) => {
    const existing = db.prepare("SELECT 1 AS ok FROM unlocks WHERE user_id = ? AND work_id = ?").get(userId, workId);
    if (existing) return { ok: false as const, error: "这篇已经解锁过了" };
    const changed = db
      .prepare("UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?")
      .run(cost, userId, cost);
    if (changed.changes !== 1) return { ok: false as const, error: "金币不够，先去充值" };
    db.prepare("INSERT INTO unlocks (user_id, work_id, created_at) VALUES (?, ?, ?)").run(userId, workId, now);
    db.prepare(
      "UPDATE works SET purchase_count = COALESCE(purchase_count, 0) + 1 WHERE id = ?",
    ).run(workId);
    db.prepare("INSERT INTO ledger (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)").run(
      userId,
      -cost,
      `解锁《${title}》`,
      now,
    );
    return { ok: true as const };
  });
}

/** 金币买断：扣币后独占。 */
export function buyoutWorkWithCoins(userId: number, workId: number, title: string, coins = BUYOUT_COINS) {
  const now = nowIso();
  const cost = Math.max(0, Math.floor(coins));
  return txn((db) => {
    const work = db.prepare("SELECT buyout_user_id FROM works WHERE id = ?").get(workId) as
      | { buyout_user_id: number | null }
      | undefined;
    if (!work) return { ok: false as const, error: "作品不存在" };
    if (work.buyout_user_id && work.buyout_user_id !== userId) {
      return { ok: false as const, error: "这篇已被他人买断" };
    }
    if (work.buyout_user_id === userId) return { ok: true as const, already: true };

    const charged = db
      .prepare("UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?")
      .run(cost, userId, cost);
    if (charged.changes !== 1) return { ok: false as const, error: "金币不够，先去充值" };

    db.prepare("UPDATE works SET buyout_user_id = ?, buyout_at = ? WHERE id = ?").run(userId, now, workId);
    const existing = db
      .prepare("SELECT buyout FROM unlocks WHERE user_id = ? AND work_id = ?")
      .get(userId, workId) as { buyout: number } | undefined;
    if (existing) {
      db.prepare("UPDATE unlocks SET buyout = 1 WHERE user_id = ? AND work_id = ?").run(userId, workId);
    } else {
      db.prepare("INSERT INTO unlocks (user_id, work_id, created_at, buyout) VALUES (?, ?, ?, 1)").run(
        userId,
        workId,
        now,
      );
      db.prepare(
        "UPDATE works SET purchase_count = COALESCE(purchase_count, 0) + 1 WHERE id = ?",
      ).run(workId);
    }
    db.prepare("INSERT INTO ledger (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)").run(
      userId,
      -cost,
      `买断《${title}》`,
      now,
    );
    return { ok: true as const, already: false };
  });
}

/** 金币支付征稿赏金。bounty 字段存的是金币数。 */
export function payRequirementWithCoins(userId: number, requirementId: number) {
  const now = nowIso();
  return txn((db) => {
    const row = db.prepare("SELECT * FROM requirements WHERE id = ?").get(requirementId) as
      | RequirementRow
      | undefined;
    if (!row) return { ok: false as const, error: "征稿不存在" };
    if (row.user_id !== userId) return { ok: false as const, error: "只能支付自己的征稿" };
    if (row.status === "paid" || row.status === "making" || row.status === "delivered") {
      return { ok: true as const, already: true };
    }
    if (row.status !== "awaiting_pay") return { ok: false as const, error: "当前状态不能付款" };
    const cost = Math.max(0, Math.floor(row.bounty_yuan));
    const charged = db
      .prepare("UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?")
      .run(cost, userId, cost);
    if (charged.changes !== 1) return { ok: false as const, error: "金币不够，先去充值" };
    db.prepare("UPDATE requirements SET status = 'paid', paid_at = ? WHERE id = ?").run(now, requirementId);
    db.prepare("INSERT INTO ledger (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)").run(
      userId,
      -cost,
      `征稿赏金《${row.title}》`,
      now,
    );
    return { ok: true as const, already: false };
  });
}

export function hasWorkBuyout(userId: number, workId: number) {
  const row = one<{ buyout_user_id: number | null }>(
    "SELECT buyout_user_id FROM works WHERE id = ?",
    workId,
  );
  return row?.buyout_user_id === userId;
}

/** 该篇是否已被某人独占买断（任意用户）。 */
export function isWorkBuyoutTaken(workId: number) {
  const row = one<{ buyout_user_id: number | null }>(
    "SELECT buyout_user_id FROM works WHERE id = ?",
    workId,
  );
  return Boolean(row?.buyout_user_id);
}

export function getWorkBuyoutUserId(workId: number) {
  const row = one<{ buyout_user_id: number | null }>(
    "SELECT buyout_user_id FROM works WHERE id = ?",
    workId,
  );
  return row?.buyout_user_id ?? null;
}

export function grantUnlockPaid(userId: number, workId: number, title: string, yuan: number) {
  const now = nowIso();
  return txn((db) => {
    const existing = db
      .prepare("SELECT buyout FROM unlocks WHERE user_id = ? AND work_id = ?")
      .get(userId, workId) as { buyout: number } | undefined;
    if (existing) return { ok: true as const, already: true };
    db.prepare("INSERT INTO unlocks (user_id, work_id, created_at, buyout) VALUES (?, ?, ?, 0)").run(
      userId,
      workId,
      now,
    );
    db.prepare(
      "UPDATE works SET purchase_count = COALESCE(purchase_count, 0) + 1 WHERE id = ?",
    ).run(workId);
    db.prepare("INSERT INTO ledger (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)").run(
      userId,
      0,
      `购买《${title}》¥${yuan}`,
      now,
    );
    return { ok: true as const, already: false };
  });
}

/** 单篇独占买断：仅买断者可再读；其他人（含先前购买者）失去阅读权。 */
export function grantWorkBuyout(userId: number, workId: number, title: string) {
  const now = nowIso();
  return txn((db) => {
    const work = db.prepare("SELECT buyout_user_id FROM works WHERE id = ?").get(workId) as
      | { buyout_user_id: number | null }
      | undefined;
    if (!work) return { ok: false as const, error: "作品不存在" };
    if (work.buyout_user_id && work.buyout_user_id !== userId) {
      return { ok: false as const, error: "这篇已被他人买断" };
    }
    if (work.buyout_user_id === userId) return { ok: true as const, already: true };

    db.prepare("UPDATE works SET buyout_user_id = ?, buyout_at = ? WHERE id = ?").run(userId, now, workId);

    const existing = db
      .prepare("SELECT buyout FROM unlocks WHERE user_id = ? AND work_id = ?")
      .get(userId, workId) as { buyout: number } | undefined;
    if (existing) {
      db.prepare("UPDATE unlocks SET buyout = 1 WHERE user_id = ? AND work_id = ?").run(userId, workId);
    } else {
      db.prepare("INSERT INTO unlocks (user_id, work_id, created_at, buyout) VALUES (?, ?, ?, 1)").run(
        userId,
        workId,
        now,
      );
    }
    db.prepare(
      "UPDATE works SET purchase_count = COALESCE(purchase_count, 0) + 1 WHERE id = ?",
    ).run(workId);
    db.prepare("INSERT INTO ledger (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)").run(
      userId,
      0,
      `买断《${title}》¥${BUYOUT_YUAN}`,
      now,
    );
    return { ok: true as const, already: false };
  });
}

export function createPayOrder(input: {
  mchOrderNo: string;
  userId: number;
  kind: string;
  workId: number | null;
  requirementId?: number | null;
  amountFen: number;
  payUrl: string;
  serialOrderNo: string;
}) {
  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO pay_orders
        (mch_order_no, user_id, kind, work_id, requirement_id, amount_fen, status, pay_url, serial_order_no, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'PROCESSING', ?, ?, ?)`,
    )
    .run(
      input.mchOrderNo,
      input.userId,
      input.kind,
      input.workId,
      input.requirementId ?? null,
      input.amountFen,
      input.payUrl,
      input.serialOrderNo,
      now,
    );
}

const REQUIREMENT_CARD = `
  SELECT r.*, u.username
  FROM requirements r
  JOIN users u ON u.id = r.user_id
`;

export function createRequirement(input: {
  userId: number;
  title: string;
  kind: Kind;
  category: string;
  brief: string;
  referenceText: string;
  bountyYuan: number;
}) {
  const now = nowIso();
  const result = getDb()
    .prepare(
      `INSERT INTO requirements
        (user_id, title, kind, category, brief, reference_text, bounty_yuan, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'awaiting_pay', ?)`,
    )
    .run(
      input.userId,
      input.title,
      input.kind,
      input.category,
      input.brief,
      input.referenceText,
      input.bountyYuan,
      now,
    );
  return Number(result.lastInsertRowid);
}

export function getRequirement(id: number) {
  return one<RequirementRow>(`${REQUIREMENT_CARD} WHERE r.id = ?`, id);
}

export function listPublicRequirements(limit = 40) {
  const size = Math.min(Math.max(limit, 1), 80);
  return many<RequirementRow>(
    `${REQUIREMENT_CARD}
     WHERE r.status IN ('paid', 'making', 'delivered')
     ORDER BY
       CASE r.status WHEN 'paid' THEN 0 WHEN 'making' THEN 1 ELSE 2 END,
       r.id DESC
     LIMIT ${size}`,
  );
}

export function listRequirementsByUser(userId: number) {
  return many<RequirementRow>(
    `${REQUIREMENT_CARD} WHERE r.user_id = ? ORDER BY r.id DESC`,
    userId,
  );
}

export function listOpsRequirements() {
  return many<RequirementRow>(
    `${REQUIREMENT_CARD}
     WHERE r.status IN ('paid', 'making', 'delivered')
     ORDER BY
       CASE r.status WHEN 'paid' THEN 0 WHEN 'making' THEN 1 ELSE 2 END,
       r.id DESC
     LIMIT 100`,
  );
}

export function markRequirementPaid(requirementId: number) {
  const now = nowIso();
  return txn((db) => {
    const row = db.prepare("SELECT * FROM requirements WHERE id = ?").get(requirementId) as
      | RequirementRow
      | undefined;
    if (!row) return { ok: false as const, error: "征稿不存在" };
    if (row.status === "paid" || row.status === "making" || row.status === "delivered") {
      return { ok: true as const, already: true };
    }
    if (row.status !== "awaiting_pay") {
      return { ok: false as const, error: "当前状态不能付款" };
    }
    db.prepare("UPDATE requirements SET status = 'paid', paid_at = ? WHERE id = ?").run(now, requirementId);
    db.prepare("INSERT INTO ledger (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)").run(
      row.user_id,
      0,
      `征稿赏金入账《${row.title}》`,
      now,
    );
    return { ok: true as const, already: false };
  });
}

/** 站长交付：关联已上架作品，并对需求方独占买断。 */
export function deliverRequirement(requirementId: number, workId: number) {
  const now = nowIso();
  return txn((db) => {
    const row = db.prepare("SELECT * FROM requirements WHERE id = ?").get(requirementId) as
      | RequirementRow
      | undefined;
    if (!row) return { ok: false as const, error: "征稿不存在" };
    if (row.status !== "paid" && row.status !== "making") {
      return { ok: false as const, error: "仅已付款征稿可交付" };
    }
    const work = db.prepare("SELECT id, title, status, buyout_user_id FROM works WHERE id = ?").get(workId) as
      | { id: number; title: string; status: string; buyout_user_id: number | null }
      | undefined;
    if (!work || work.status !== "published") {
      return { ok: false as const, error: "请填写已上架的作品 ID" };
    }
    if (work.buyout_user_id && work.buyout_user_id !== row.user_id) {
      return { ok: false as const, error: "该作品已被他人买断" };
    }

    db.prepare(
      "UPDATE works SET buyout_user_id = ?, buyout_at = COALESCE(buyout_at, ?) WHERE id = ?",
    ).run(row.user_id, now, workId);

    const existing = db
      .prepare("SELECT buyout FROM unlocks WHERE user_id = ? AND work_id = ?")
      .get(row.user_id, workId) as { buyout: number } | undefined;
    if (existing) {
      db.prepare("UPDATE unlocks SET buyout = 1 WHERE user_id = ? AND work_id = ?").run(row.user_id, workId);
    } else {
      db.prepare("INSERT INTO unlocks (user_id, work_id, created_at, buyout) VALUES (?, ?, ?, 1)").run(
        row.user_id,
        workId,
        now,
      );
      db.prepare(
        "UPDATE works SET purchase_count = COALESCE(purchase_count, 0) + 1 WHERE id = ?",
      ).run(workId);
    }

    db.prepare(
      `UPDATE requirements
       SET status = 'delivered', delivered_work_id = ?, delivered_at = ?
       WHERE id = ?`,
    ).run(workId, now, requirementId);
    db.prepare("INSERT INTO ledger (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)").run(
      row.user_id,
      0,
      `征稿交付《${row.title}》→《${work.title}》`,
      now,
    );
    return { ok: true as const, workId, title: work.title };
  });
}

export function setRequirementMaking(requirementId: number) {
  const row = getRequirement(requirementId);
  if (!row) return { ok: false as const, error: "征稿不存在" };
  if (row.status !== "paid") return { ok: false as const, error: "仅已付款可标制作中" };
  getDb().prepare("UPDATE requirements SET status = 'making' WHERE id = ?").run(requirementId);
  return { ok: true as const };
}

export function findPayOrder(mchOrderNo: string) {
  return one<PayOrderRow>("SELECT * FROM pay_orders WHERE mch_order_no = ?", mchOrderNo);
}

/** 上游收银台 order_sn（serial）反查本站订单。 */
export function findPayOrderBySerial(serialOrderNo: string) {
  const serial = serialOrderNo.trim();
  if (!serial) return null;
  return one<PayOrderRow>("SELECT * FROM pay_orders WHERE serial_order_no = ? ORDER BY id DESC LIMIT 1", serial);
}

export function findPayOrderByAny(ref: string) {
  const key = ref.trim();
  if (!key) return null;
  return findPayOrder(key) || findPayOrderBySerial(key);
}

export function markPayOrderPaid(mchOrderNo: string, serialOrderNo?: string) {
  const now = nowIso();
  return txn((db) => {
    const order = db.prepare("SELECT * FROM pay_orders WHERE mch_order_no = ?").get(mchOrderNo) as
      | PayOrderRow
      | undefined;
    if (!order) return { ok: false as const, error: "订单不存在" };
    if (order.status === "SUCCESS") return { ok: true as const, order, already: true };
    db.prepare(
      `UPDATE pay_orders
       SET status = 'SUCCESS', paid_at = ?, serial_order_no = COALESCE(?, serial_order_no)
       WHERE mch_order_no = ?`,
    ).run(now, serialOrderNo || null, mchOrderNo);
    return { ok: true as const, order: { ...order, status: "SUCCESS", paid_at: now }, already: false };
  });
}

export function rechargeCoins(userId: number, coins: number, reason: string) {
  const now = nowIso();
  txn((db) => {
    db.prepare("UPDATE users SET coins = coins + ? WHERE id = ?").run(coins, userId);
    db.prepare("INSERT INTO ledger (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)").run(
      userId,
      coins,
      reason,
      now,
    );
  });
}

export function listLedger(userId: number) {
  return many<LedgerRow>(
    "SELECT id, user_id, delta, reason, created_at FROM ledger WHERE user_id = ? ORDER BY id DESC LIMIT 40",
    userId,
  );
}

export function getCheckinState(userId: number) {
  const today = shanghaiToday();
  const todayRow = one<CheckinRow>("SELECT * FROM checkins WHERE user_id = ? AND day = ?", userId, today);
  const yesterday = one<CheckinRow>(
    "SELECT * FROM checkins WHERE user_id = ? AND day = ?",
    userId,
    previousDay(today),
  );
  const recent = many<CheckinRow>(
    "SELECT * FROM checkins WHERE user_id = ? ORDER BY day DESC LIMIT 7",
    userId,
  );
  if (todayRow) {
    return { today, checkedIn: true, streak: todayRow.streak, reward: todayRow.coins, recent };
  }
  const streak = yesterday ? yesterday.streak + 1 : 1;
  return { today, checkedIn: false, streak, reward: checkinReward(streak), recent };
}

export function checkIn(userId: number) {
  const today = shanghaiToday();
  try {
    return txn((db) => {
      const existing = db.prepare("SELECT id FROM checkins WHERE user_id = ? AND day = ?").get(userId, today);
      if (existing) return { ok: false as const, error: "今天已经签过了" };
      const yesterday = db
        .prepare("SELECT streak FROM checkins WHERE user_id = ? AND day = ?")
        .get(userId, previousDay(today)) as { streak: number } | undefined;
      const streak = yesterday ? yesterday.streak + 1 : 1;
      const coins = checkinReward(streak);
      const now = nowIso();
      db.prepare(
        "INSERT INTO checkins (user_id, day, streak, coins, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run(userId, today, streak, coins, now);
      const changed = db.prepare("UPDATE users SET coins = coins + ? WHERE id = ?").run(coins, userId);
      if (changed.changes !== 1) throw new Error("找不到这个账号");
      db.prepare("INSERT INTO ledger (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)").run(
        userId,
        coins,
        `签到 · 连续 ${streak} 天`,
        now,
      );
      return { ok: true as const, streak, coins };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE") && message.includes("checkins")) {
      return { ok: false as const, error: "今天已经签过了" };
    }
    throw error;
  }
}

export function getInviteProfile(userId: number) {
  const user = findUserById(userId);
  const people = many<{ username: string; created_at: string }>(
    `SELECT username, created_at FROM users
     WHERE invited_by = ? AND email_verified_at IS NOT NULL
     ORDER BY id DESC LIMIT 20`,
    userId,
  );
  const countRow = one<{ c: number }>(
    "SELECT COUNT(*) AS c FROM users WHERE invited_by = ? AND email_verified_at IS NOT NULL",
    userId,
  );
  const earned = one<{ total: number }>(
    "SELECT COALESCE(SUM(delta), 0) AS total FROM ledger WHERE user_id = ? AND reason LIKE '邀请奖励%'",
    userId,
  );
  const inviter = user?.invited_by
    ? one<{ username: string }>("SELECT username FROM users WHERE id = ?", user.invited_by)
    : undefined;
  return {
    code: user?.invite_code ?? "",
    invitedBy: inviter?.username ?? "",
    count: countRow?.c ?? 0,
    earned: Number(earned?.total ?? 0),
    people,
  };
}

function tokenHash(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export function issueActivationToken(userId: number) {
  const nowMs = Date.now();
  const raw = randomBytes(32).toString("base64url");
  const now = new Date(nowMs).toISOString();
  return txn((db) => {
    const latest = db
      .prepare("SELECT created_at FROM email_tokens WHERE user_id = ? ORDER BY id DESC LIMIT 1")
      .get(userId) as { created_at: string } | undefined;
    if (latest && nowMs - Date.parse(latest.created_at) < RESEND_MS) {
      return { ok: false as const, error: "刚刚发过，请一分钟后再试" };
    }
    db.prepare("UPDATE email_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL").run(now, userId);
    db.prepare(
      "INSERT INTO email_tokens (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)",
    ).run(userId, tokenHash(raw), new Date(nowMs + ACTIVATION_MS).toISOString(), now);
    return { ok: true as const, token: raw };
  });
}

export function discardUnusedActivationToken(userId: number) {
  getDb().prepare("DELETE FROM email_tokens WHERE user_id = ? AND used_at IS NULL").run(userId);
}

export function consumeActivationToken(raw: string) {
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(raw)) {
    return { ok: false as const, error: "这个链接不能用，请重新发送激活信" };
  }
  const now = nowIso();
  try {
    return txn((db) => {
      const token = db.prepare("SELECT * FROM email_tokens WHERE token_hash = ?").get(tokenHash(raw)) as
        | { id: number; user_id: number; expires_at: string; used_at: string | null }
        | undefined;
      if (!token || token.used_at) {
        return { ok: false as const, error: "这个链接已经不能用了，请重新发送激活信" };
      }
      if (Date.parse(token.expires_at) < Date.now()) {
        return { ok: false as const, error: "链接过期了，请重新发送激活信" };
      }
      const marked = db
        .prepare("UPDATE email_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL")
        .run(now, token.id);
      if (marked.changes !== 1) {
        return { ok: false as const, error: "这个链接已经不能用了，请重新发送激活信" };
      }
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(token.user_id) as UserRow | undefined;
      if (!user) return { ok: false as const, error: "找不到这个账号" };
      if (user.email_verified_at) return { ok: true as const, userId: user.id, already: true };
      db.prepare("UPDATE users SET email_verified_at = ? WHERE id = ?").run(now, user.id);
      const inviter = user.invited_by
        ? (db
            .prepare("SELECT id FROM users WHERE id = ? AND email_verified_at IS NOT NULL")
            .get(user.invited_by) as { id: number } | undefined)
        : undefined;
      const bonus = inviter ? INVITEE_COINS : 0;
      db.prepare("UPDATE users SET coins = coins + ? WHERE id = ?").run(SIGNUP_COINS + bonus, user.id);
      const ledger = db.prepare("INSERT INTO ledger (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)");
      ledger.run(user.id, SIGNUP_COINS, "注册赠送", now);
      if (inviter) {
        ledger.run(user.id, INVITEE_COINS, "接受邀请", now);
        db.prepare("UPDATE users SET coins = coins + ? WHERE id = ?").run(INVITER_COINS, inviter.id);
        ledger.run(inviter.id, INVITER_COINS, `邀请奖励 · ${user.username}`, now);
      }
      return { ok: true as const, userId: user.id, already: false };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE") && message.includes("email_tokens")) {
      return { ok: false as const, error: "这个链接已经不能用了，请重新发送激活信" };
    }
    throw error;
  }
}

export type DiscussionRow = {
  id: number;
  user_id: number;
  work_id: number | null;
  title: string;
  body: string;
  created_at: string;
  username: string;
  work_title?: string | null;
  work_status?: string | null;
  work_author?: string | null;
  work_kind?: string | null;
  work_grade?: string | null;
  work_category?: string | null;
};

export function createDiscussion(input: {
  userId: number;
  workId: number | null;
  title: string;
  body: string;
}) {
  const now = nowIso();
  const result = getDb()
    .prepare(
      `INSERT INTO discussions (user_id, work_id, title, body, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(input.userId, input.workId, input.title, input.body, now);
  return Number(result.lastInsertRowid);
}

export function listDiscussionsByWork(workId: number, limit = 40) {
  const size = Math.min(Math.max(limit, 1), 100);
  return many<DiscussionRow>(
    `SELECT d.*, u.username
     FROM discussions d
     JOIN users u ON u.id = d.user_id
     WHERE d.work_id = ?
     ORDER BY d.id DESC
     LIMIT ${size}`,
    workId,
  );
}

const DISCUSSION_WORK_JOIN = `
  SELECT d.*, u.username,
         w.title AS work_title, w.status AS work_status, w.kind AS work_kind,
         w.grade AS work_grade, w.category AS work_category,
         a.username AS work_author
  FROM discussions d
  JOIN users u ON u.id = d.user_id
  LEFT JOIN works w ON w.id = d.work_id
  LEFT JOIN users a ON a.id = w.author_id
`;

export function listRecentDiscussions(limit = 40) {
  const size = Math.min(Math.max(limit, 1), 80);
  return many<DiscussionRow>(`${DISCUSSION_WORK_JOIN} ORDER BY d.id DESC LIMIT ${size}`);
}

export function getDiscussion(id: number) {
  return one<DiscussionRow>(`${DISCUSSION_WORK_JOIN} WHERE d.id = ?`, id);
}

/** 按 ID 或标题查找已上架作品，供社区引用。 */
export function lookupPublishedWorks(query: string, limit = 12) {
  const q = query.trim();
  if (!q) return [] as PublicWork[];
  const size = Math.min(Math.max(limit, 1), 20);
  const asId = Number(q);
  if (Number.isInteger(asId) && asId > 0 && String(asId) === q) {
    const row = one<WorkRow>(`${WORK_CARD} WHERE w.id = ? AND w.status = 'published'`, asId);
    return row ? [toPublic(row)] : [];
  }
  const pattern = `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  return many<WorkRow>(
    `${WORK_CARD} WHERE w.status = 'published' AND w.kind = 'script'
     AND (w.title LIKE ? ESCAPE '\\' OR u.username LIKE ? ESCAPE '\\')
     ORDER BY w.score DESC, w.id DESC
     LIMIT ${size}`,
    pattern,
    pattern,
  ).map(toPublic);
}

export function deleteDiscussion(id: number, userId: number) {
  const row = one<{ id: number; user_id: number }>("SELECT id, user_id FROM discussions WHERE id = ?", id);
  if (!row) return { ok: false as const, error: "讨论不存在" };
  if (row.user_id !== userId) return { ok: false as const, error: "只能删除自己的发言" };
  getDb().prepare("DELETE FROM discussions WHERE id = ?").run(id);
  return { ok: true as const };
}

export function countDiscussionsByWork(workId: number) {
  const row = one<{ c: number }>("SELECT COUNT(*) AS c FROM discussions WHERE work_id = ?", workId);
  return Number(row?.c) || 0;
}
