import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { isCategory } from "@/lib/categories";
import { makeInviteCode } from "@/lib/codes";
import { INVITEE_COINS, INVITER_COINS, SIGNUP_COINS, checkinReward } from "@/lib/coins";
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
const SCHEMA = 5;
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
  `);
  const userColumns = columnNames(db, "users");
  if (!userColumns.has("invite_code")) db.exec("ALTER TABLE users ADD COLUMN invite_code TEXT");
  if (!userColumns.has("invited_by")) db.exec("ALTER TABLE users ADD COLUMN invited_by INTEGER");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_invite_code ON users(invite_code)");
  if (!userColumns.has("email_verified_at")) {
    db.exec("ALTER TABLE users ADD COLUMN email_verified_at TEXT");
    db.exec("UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL");
  }
  db.exec("UPDATE users SET username = '大黄叔' WHERE username = '墨本编辑室'");
  const editorNameTaken = db
    .prepare("SELECT id FROM users WHERE username = '大黄书' AND email != 'editor@moben.local'")
    .get();
  if (!editorNameTaken) {
    db.prepare("UPDATE users SET username = '大黄书' WHERE email = 'editor@moben.local'").run();
  }
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
         w.word_count, w.created_at, w.status, u.username AS author
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
  if (filter.kind === "script" || filter.kind === "novel") {
    where.push("w.kind = ?");
    params.push(filter.kind);
  }
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
    `${WORK_CARD} WHERE w.status = 'published' ORDER BY w.score DESC, w.id DESC LIMIT 1`,
  );
  return row ? toPublic(row) : undefined;
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
    super("每人最多保存 30 篇稿件");
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
}) {
  const now = nowIso();
  return txn((db) => {
    const count = db.prepare("SELECT COUNT(*) AS c FROM works WHERE author_id = ?").get(input.authorId) as {
      c: number;
    };
    if (count.c >= 30) throw new WorkLimitError();
    const info = db
      .prepare(
        `INSERT INTO works (
          title, kind, category, summary, content, author_id, price, status, score, grade,
          review_json, review_source, word_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.title,
        input.kind,
        input.category,
        input.summary,
        input.content,
        input.authorId,
        input.price,
        input.review.decision === "approve" ? "published" : "rejected",
        input.review.score,
        input.review.grade,
        JSON.stringify(input.review),
        input.review.source,
        input.wordCount,
        now,
      );
    return Number(info.lastInsertRowid);
  });
}

export function unlockWork(userId: number, workId: number, price: number, title: string) {
  const now = nowIso();
  return txn((db) => {
    const existing = db.prepare("SELECT 1 AS ok FROM unlocks WHERE user_id = ? AND work_id = ?").get(userId, workId);
    if (existing) return { ok: false as const, error: "这篇已经解锁过了" };
    const changed = db
      .prepare("UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?")
      .run(price, userId, price);
    if (changed.changes !== 1) return { ok: false as const, error: "金币不够，先去充值" };
    db.prepare("INSERT INTO unlocks (user_id, work_id, created_at) VALUES (?, ?, ?)").run(userId, workId, now);
    db.prepare("INSERT INTO ledger (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)").run(
      userId,
      -price,
      `解锁《${title}》`,
      now,
    );
    return { ok: true as const };
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
