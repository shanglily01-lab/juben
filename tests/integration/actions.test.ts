import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentUser } from "@/lib/auth";
import {
  activateAction,
  checkinAction,
  loginAction,
  logoutAction,
  registerAction,
  resendActivationAction,
  unlockAction,
  uploadAction,
} from "@/lib/actions";
import {
  findUserByEmail,
  getDb,
  getWorkDetail,
  insertWork,
  listLedger,
  listWorks,
  rechargeCoins,
} from "@/lib/db";
import { countWords } from "@/lib/format";
import { latestOutboxLink } from "@/lib/mail";
import { unlockCoinsFromScore } from "@/lib/pricing";
import { readSeedWorks } from "@/lib/seed";
import type { ActionState } from "@/lib/types";

const { cookieJar } = vi.hoisted(() => ({ cookieJar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get(name: string) {
      const value = cookieJar.get(name);
      return value ? { name, value } : undefined;
    },
    set(name: string, value: string) {
      cookieJar.set(name, value);
    },
    delete(name: string) {
      cookieJar.delete(name);
    },
  }),
  headers: async () => new Headers({ host: "127.0.0.1:3000", "x-forwarded-proto": "http" }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
}));

vi.mock("next/navigation", () => ({
  redirect(url: string): never {
    const error = new Error(`redirect ${url}`) as Error & { url: string };
    error.url = url;
    throw error;
  },
}));

const empty: ActionState = { error: "" };

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

async function redirectUrl(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (error instanceof Error && "url" in error && typeof error.url === "string") return error.url;
    throw error;
  }
  throw new Error("没有发生跳转");
}

function tokenFrom(link: string) {
  const token = new URL(link).searchParams.get("token");
  if (!token) throw new Error("激活信里没有链接");
  return token;
}

let serial = 0;

function identity(label: string) {
  serial += 1;
  const stamp = `${Date.now().toString(36)}${serial}`;
  return {
    username: `流${label}${stamp}`.slice(0, 16),
    email: `flow-${label}-${stamp}@example.com`,
    password: "demo1234",
  };
}

async function register(label: string, invite = "") {
  const user = identity(label);
  const url = await redirectUrl(() =>
    registerAction(empty, form({ username: user.username, email: user.email, password: user.password, invite, next: "/mine" })),
  );
  expect(url).toContain("sent=1");
  expect(url).toContain(encodeURIComponent(user.email));
  const link = latestOutboxLink(user.email);
  expect(link.startsWith("http://127.0.0.1:3000/activate?token=")).toBe(true);
  return { ...user, token: tokenFrom(link) };
}

async function activate(token: string) {
  const url = await redirectUrl(() => activateAction(empty, form({ token, next: "/mine" })));
  expect(url).toBe("/mine?activated=1");
  const current = await getCurrentUser();
  expect(current).toBeTruthy();
  return current!;
}

beforeEach(() => {
  cookieJar.clear();
});

describe("注册登录整条链路", () => {
  it("格式不对或邀请码不存在时停在表单上", async () => {
    expect((await registerAction(empty, form({ username: "读者甲", email: "bad", password: "demo1234" }))).error).toBe(
      "邮箱格式不对",
    );
    expect((await registerAction(empty, form({ username: "读者甲", email: "a@b.c", password: "short" }))).error).toBe(
      "密码至少 8 位",
    );
    expect(
      (await registerAction(empty, form({ username: "读者甲", email: "a@b.c", password: "x".repeat(73) }))).error,
    ).toBe("密码最多 72 位");
    expect(
      (await registerAction(empty, form({ username: "读者甲", email: "a@b.co", password: "demo1234", invite: "ab" }))).error,
    ).toBe("邀请码只含字母和数字");
    expect(
      (
        await registerAction(
          empty,
          form({ username: "读者甲", email: "a@b.co", password: "demo1234", invite: "NOTEXIST" }),
        )
      ).error,
    ).toBe("邀请码不存在");
  });

  it("激活前不能登录，激活后金币入账并能再次登录", async () => {
    const user = await register("甲");
    expect(await getCurrentUser()).toBeNull();
    const pending = await redirectUrl(() =>
      loginAction(empty, form({ login: user.email, password: user.password, next: "/mine" })),
    );
    expect(pending).toContain("pending=1");
    expect(await getCurrentUser()).toBeNull();

    const current = await activate(user.token);
    expect(current.coins).toBe(20);
    expect(current.username).toBe(user.username);

    await redirectUrl(() => logoutAction());
    expect(await getCurrentUser()).toBeNull();
    expect((await loginAction(empty, form({ login: user.username, password: "wrong-pass" }))).error).toBe(
      "账号或密码不对",
    );
    const back = await redirectUrl(() =>
      loginAction(empty, form({ login: user.username, password: user.password, next: "/wallet" })),
    );
    expect(back).toBe("/wallet");
    expect((await getCurrentUser())?.id).toBe(current.id);
  });

  it("重发后旧链接失效，已激活的邮箱不能再发", async () => {
    const user = await register("乙");
    expect((await resendActivationAction(empty, form({ email: user.email }))).error).toContain("刚刚发过");
    const row = findUserByEmail(user.email);
    getDb()
      .prepare("UPDATE email_tokens SET created_at = ? WHERE user_id = ?")
      .run("2000-01-01T00:00:00.000Z", row?.id);
    const resent = await redirectUrl(() => resendActivationAction(empty, form({ email: user.email, next: "/mine" })));
    expect(resent).toContain("resent=1");
    expect((await activateAction(empty, form({ token: user.token }))).error).toContain("不能用");
    await activate(tokenFrom(latestOutboxLink(user.email)));
    expect((await resendActivationAction(empty, form({ email: user.email }))).error).toBe("这个邮箱已经激活，直接登录");
  });

  it("邀请奖励要等被邀请人激活才入账", async () => {
    const inviter = await register("丙");
    const inviterUser = await activate(inviter.token);
    const code = getDb().prepare("SELECT invite_code FROM users WHERE id = ?").get(inviterUser.id) as {
      invite_code: string;
    };
    cookieJar.clear();
    const invitee = await register("丁", code.invite_code);
    expect((await getCurrentUser())?.coins ?? 0).toBe(0);
    expect(findUserByEmail(inviter.email)?.coins).toBe(20);
    const inviteeUser = await activate(invitee.token);
    expect(inviteeUser.coins).toBe(30);
    expect(findUserByEmail(inviter.email)?.coins).toBe(35);
    expect(listLedger(inviterUser.id).some((entry) => entry.reason === `邀请奖励 · ${invitee.username}`)).toBe(true);
    expect(listLedger(inviteeUser.id).map((entry) => entry.reason)).toEqual(expect.arrayContaining(["注册赠送", "接受邀请"]));
  });
});

describe("签到、充值、解锁、投稿", () => {
  it("登录后才能签到，同一天第二次被拒绝", async () => {
    expect((await checkinAction(empty)).error).toBe("请先登录");
    const user = await register("戊");
    await activate(user.token);
    expect(await redirectUrl(() => checkinAction(empty))).toBe("/checkin?ok=1");
    expect((await getCurrentUser())?.coins).toBe(22);
    expect((await checkinAction(empty)).error).toBe("今天已经签过了");
    expect((await getCurrentUser())?.coins).toBe(22);
  });

  it("金币不够时解锁失败，充值后能解开，同一篇不重复扣", async () => {
    const user = await register("己");
    const current = await activate(user.token);
    const paid = listWorks({})
      .filter((work) => work.price > 0)
      .map((work) => {
        const detail = getWorkDetail(work.id)!;
        return {
          id: work.id,
          coins: unlockCoinsFromScore(detail.score, Math.max(1, detail.episode_count || 1)),
        };
      })
      .sort((left, right) => left.coins - right.coins);
    const free = listWorks({}).find((work) => work.price === 0);
    expect(paid.length).toBeGreaterThanOrEqual(2);
    expect(free).toBeTruthy();
    if (!free || paid.length < 2) return;
    const [first, second] = paid;
    expect((await unlockAction(empty, form({ workId: String(free.id) }))).error).toBe("这篇是免费的");
    expect((await unlockAction(empty, form({ workId: String(first.id) }))).error).toBe("金币不够，先去充值");

    rechargeCoins(current.id, first.coins, "测试充值");
    expect(await redirectUrl(() => unlockAction(empty, form({ workId: String(first.id) })))).toBe(
      `/works/${first.id}`,
    );
    const afterFirst = (await getCurrentUser())?.coins ?? 0;
    expect(afterFirst).toBe(20);
    expect((await unlockAction(empty, form({ workId: String(second.id) }))).error).toBe("金币不够，先去充值");
    expect(await redirectUrl(() => unlockAction(empty, form({ workId: String(first.id) })))).toBe(
      `/works/${first.id}`,
    );
    expect((await getCurrentUser())?.coins).toBe(afterFirst);

    rechargeCoins(current.id, second.coins, "测试充值");
    expect(await redirectUrl(() => unlockAction(empty, form({ workId: String(second.id) })))).toBe(
      `/works/${second.id}`,
    );
  });

  it("太短的稿送不进审核，够格的稿上架，自己的稿不能解锁", async () => {
    const user = await register("庚");
    const current = await activate(user.token);
    const summary = "这是一段用来测试投稿的简介。";
    const tooShort = await uploadAction(
      empty,
      form({
        title: "太短",
        summary,
        kind: "script",
        category: "urban",
        price: "0",
        content: "只有几个字。",
      }),
    );
    expect(tooShort.error).toContain("至少 200 字");

    const script = readSeedWorks().find((work) => work.kind === "script");
    expect(script).toBeTruthy();
    if (!script) return;
    const uploaded = await redirectUrl(() =>
      uploadAction(
        empty,
        form({
          title: script.title,
          summary: script.summary,
          kind: script.kind,
          category: script.category,
          price: "6",
          content: script.content,
        }),
      ),
    );
    const workId = Number(uploaded.replace("/works/", ""));
    const detail = getWorkDetail(workId);
    expect(detail?.status).toBe("published");
    expect(detail?.author_id).toBe(current.id);
    expect((await unlockAction(empty, form({ workId: String(workId) }))).error).toBe("这是你自己的稿件");

    for (let index = 0; index < 29; index += 1) {
      insertWork({
        title: `占位${index}`,
        kind: "script",
        category: "urban",
        summary: "占位稿，不送审。",
        content: "占位",
        authorId: current.id,
        price: 0,
        review: {
          score: 5,
          grade: "未过",
          decision: "reject",
          source: "local",
          summary: "占位",
          advice: [],
          dimensions: { plot: 5, character: 5, pacing: 5, language: 5, completeness: 5 },
        },
        wordCount: countWords("占位"),
      });
    }
    expect(
      (
        await uploadAction(
          empty,
          form({
            title: "第三十一篇",
            summary,
            kind: "script",
            category: "urban",
            price: "0",
            content: script.content,
          }),
        )
      ).error,
    ).toBe("每人最多保存 30 篇稿件");
  });
});
