import { describe, expect, it } from "vitest";

import { hashPassword } from "@/lib/password";
import {
  InvalidInviteError,
  checkIn,
  consumeActivationToken,
  discardUnusedActivationToken,
  findUserById,
  getCheckinState,
  getDb,
  getInviteProfile,
  issueActivationToken,
  listLedger,
  listWorks,
  registerUser,
  unlockWork,
} from "@/lib/db";
import { previousDay, shanghaiToday } from "@/lib/format";

let serial = 0;

function person(label: string, inviteCode?: string) {
  serial += 1;
  const stamp = `${Date.now().toString(36)}${serial}`;
  const email = `domain-${label}-${stamp}@example.com`;
  const id = registerUser({
    username: `库${label}${stamp}`.slice(0, 16),
    email,
    passwordHash: hashPassword("demo1234"),
    inviteCode,
  });
  return { id, email, username: findUserById(id)?.username ?? "" };
}

describe("账号、激活、邀请", () => {
  it("编辑室账号已激活，书库里有上架稿", () => {
    const editor = getDb().prepare("SELECT email_verified_at, invite_code FROM users WHERE email = ?").get(
      "editor@moben.local",
    ) as { email_verified_at: string | null; invite_code: string | null };
    expect(editor.email_verified_at).toBeTruthy();
    expect(editor.invite_code).toHaveLength(8);
    expect(listWorks({}).length).toBeGreaterThanOrEqual(8);
  });

  it("未激活没有金币，激活后到账 20，链接不能再用", () => {
    const user = person("甲");
    expect(findUserById(user.id)?.coins).toBe(0);
    expect(findUserById(user.id)?.email_verified_at).toBeNull();

    const issued = issueActivationToken(user.id);
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    expect(issueActivationToken(user.id).ok).toBe(false);

    const done = consumeActivationToken(issued.token);
    expect(done.ok).toBe(true);
    expect(findUserById(user.id)?.coins).toBe(20);
    expect(consumeActivationToken(issued.token).ok).toBe(false);
    expect(listLedger(user.id).map((entry) => entry.reason)).toContain("注册赠送");
  });

  it("未激活的邀请码不能注册，激活后双方才入账", () => {
    const inviter = person("乙");
    const pendingCode = findUserById(inviter.id)?.invite_code ?? "";
    expect(() => person("丙", pendingCode)).toThrow(InvalidInviteError);
    expect(findUserById(inviter.id)?.coins).toBe(0);

    const token = issueActivationToken(inviter.id);
    expect(token.ok).toBe(true);
    if (!token.ok) return;
    expect(consumeActivationToken(token.token).ok).toBe(true);

    const invitee = person("丁", findUserById(inviter.id)?.invite_code ?? undefined);
    expect(findUserById(invitee.id)?.coins).toBe(0);
    expect(findUserById(inviter.id)?.coins).toBe(20);
    const inviteToken = issueActivationToken(invitee.id);
    expect(inviteToken.ok).toBe(true);
    if (!inviteToken.ok) return;
    expect(consumeActivationToken(inviteToken.token).ok).toBe(true);

    expect(findUserById(invitee.id)?.coins).toBe(30);
    expect(findUserById(inviter.id)?.coins).toBe(35);
    const profile = getInviteProfile(inviter.id);
    expect(profile.count).toBe(1);
    expect(profile.earned).toBe(15);
    expect(profile.people.map((item) => item.username)).toContain(invitee.username);
    expect(getInviteProfile(invitee.id).invitedBy).toBe(findUserById(inviter.id)?.username);
  });

  it("过期链接和被换掉的链接都不能激活", () => {
    const expiredUser = person("戊");
    const expired = issueActivationToken(expiredUser.id);
    expect(expired.ok).toBe(true);
    if (!expired.ok) return;
    getDb()
      .prepare("UPDATE email_tokens SET expires_at = ? WHERE user_id = ?")
      .run("2000-01-01T00:00:00.000Z", expiredUser.id);
    const expiredResult = consumeActivationToken(expired.token);
    expect(expiredResult.ok).toBe(false);
    if (!expiredResult.ok) expect(expiredResult.error).toContain("过期");

    const rotated = person("己");
    const older = issueActivationToken(rotated.id);
    expect(older.ok).toBe(true);
    if (!older.ok) return;
    getDb()
      .prepare("UPDATE email_tokens SET created_at = ? WHERE user_id = ?")
      .run("2000-01-01T00:00:00.000Z", rotated.id);
    const newer = issueActivationToken(rotated.id);
    expect(newer.ok).toBe(true);
    if (!newer.ok) return;
    expect(consumeActivationToken(older.token).ok).toBe(false);
    expect(consumeActivationToken(newer.token).ok).toBe(true);
  });

  it("没发出去的激活信不占用重发间隔，旧链接同时作废", () => {
    const user = person("壬");
    const first = issueActivationToken(user.id);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    discardUnusedActivationToken(user.id);
    const second = issueActivationToken(user.id);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(consumeActivationToken(first.token).ok).toBe(false);
    expect(consumeActivationToken(second.token).ok).toBe(true);
    expect(findUserById(user.id)?.coins).toBe(20);
  });
});

describe("签到和解锁", () => {
  function activated(label: string) {
    const user = person(label);
    const issued = issueActivationToken(user.id);
    if (!issued.ok) throw new Error(issued.error);
    const done = consumeActivationToken(issued.token);
    if (!done.ok) throw new Error(done.error);
    return user.id;
  }

  it("当天只能签一次，断一天从 2 重新开始，连续签到接着加", () => {
    const today = shanghaiToday();
    const resetId = activated("庚");
    getDb()
      .prepare("INSERT INTO checkins (user_id, day, streak, coins, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(resetId, previousDay(previousDay(today)), 6, 8, new Date().toISOString());
    const reset = checkIn(resetId);
    expect(reset).toMatchObject({ ok: true, streak: 1, coins: 2 });
    expect(checkIn(resetId)).toMatchObject({ ok: false, error: "今天已经签过了" });
    expect(findUserById(resetId)?.coins).toBe(22);
    expect(getCheckinState(resetId).checkedIn).toBe(true);

    const continueId = activated("辛");
    getDb()
      .prepare("INSERT INTO checkins (user_id, day, streak, coins, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(continueId, previousDay(today), 3, 4, new Date().toISOString());
    expect(checkIn(continueId)).toMatchObject({ ok: true, streak: 4, coins: 5 });
    expect(listLedger(continueId)[0]?.reason).toBe("签到 · 连续 4 天");
  });

  it("余额不够不能解锁，同一篇只扣一次", () => {
    const userId = activated("壬");
    const paid = listWorks({})
      .filter((work) => work.price > 0)
      .sort((left, right) => right.price - left.price);
    expect(paid.length).toBeGreaterThanOrEqual(2);
    const [first, second] = paid;
    expect(first && second).toBeTruthy();
    if (!first || !second) return;
    expect(unlockWork(userId, first.id, first.price, first.title).ok).toBe(true);
    expect(findUserById(userId)?.coins).toBe(20 - first.price);
    expect(unlockWork(userId, second.id, second.price, second.title)).toMatchObject({
      ok: false,
      error: "金币不够，先去充值",
    });
    expect(findUserById(userId)?.coins).toBe(20 - first.price);
    expect(unlockWork(userId, first.id, first.price, first.title)).toMatchObject({
      ok: false,
      error: "这篇已经解锁过了",
    });
    expect(findUserById(userId)?.coins).toBe(20 - first.price);
  });

  it("搜索里的通配符不会变成匹配全部", () => {
    const all = listWorks({ limit: 60 });
    expect(listWorks({ q: "%", limit: 60 })).toHaveLength(0);
    expect(listWorks({ q: "_", limit: 60 })).toHaveLength(0);
    expect(listWorks({ q: "旧剑", limit: 60 }).some((work) => work.title === "旧剑")).toBe(true);
    expect(all.length).toBeGreaterThan(0);
  });
});
