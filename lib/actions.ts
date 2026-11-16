"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isCategory } from "@/lib/categories";
import { findPack } from "@/lib/coins";
import { normalizeInviteCode } from "@/lib/codes";
import { countWords, safeNext } from "@/lib/format";
import { reviewWork } from "@/lib/ai";
import { clearSession, getCurrentUser, setSession } from "@/lib/auth";
import {
  checkIn,
  consumeActivationToken,
  countWorksByAuthor,
  findUserByEmail,
  findUserByLogin,
  getWorkDetail,
  hasUnlock,
  insertWork,
  InvalidInviteError,
  discardUnusedActivationToken,
  issueActivationToken,
  rechargeCoins,
  registerUser,
  unlockWork,
  WorkLimitError,
} from "@/lib/db";
import { sendActivationMail } from "@/lib/mail";
import { requestOrigin } from "@/lib/origin";
import { hashPassword, verifyPassword } from "@/lib/password";
import type { ActionState, Kind } from "@/lib/types";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

function isEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 80;
}

async function mailActivation(userId: number, email: string, username: string) {
  const origin = await requestOrigin();
  if (!origin) return { error: "激活信没有发出去，请稍后再试" };
  const issued = issueActivationToken(userId);
  if (!issued.ok) return { error: issued.error };
  const link = `${origin}/activate?token=${issued.token}`;
  try {
    await sendActivationMail({ to: email, username, link });
  } catch {
    discardUnusedActivationToken(userId);
    return { error: "激活信没有发出去，请稍后再试" };
  }
  return { error: "" };
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const username = text(formData, "username");
  const email = text(formData, "email").toLowerCase();
  const password = text(formData, "password");
  const next = safeNext(text(formData, "next"), "/");
  const inviteCode = normalizeInviteCode(text(formData, "invite"));
  if (inviteCode === null) return { error: "邀请码只含字母和数字" };

  if (!/^[\u4e00-\u9fffA-Za-z0-9_]{2,16}$/.test(username)) {
    return { error: "名字用 2 到 16 位中文、字母或数字" };
  }
  if (!isEmail(email)) return { error: "邮箱格式不对" };
  if (password.length < 8) return { error: "密码至少 8 位" };
  if (password.length > 72) return { error: "密码最多 72 位" };

  let userId = 0;
  try {
    userId = registerUser({ username, email, passwordHash: hashPassword(password), inviteCode });
  } catch (error) {
    if (error instanceof InvalidInviteError) return { error: error.message };
    const message = error instanceof Error ? error.message : "";
    if (message.includes("users.username")) return { error: "这个名字已经有人用了" };
    if (message.includes("users.email")) return { error: "这个邮箱已经注册过" };
    return { error: "注册没有成功，请稍后再试" };
  }

  const mailed = await mailActivation(userId, email, username);
  const query = new URLSearchParams({ sent: "1", email, next });
  if (mailed.error) query.set("failed", "1");
  revalidateAll();
  redirect(`/activate?${query}`);
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const login = text(formData, "login");
  const password = text(formData, "password");
  const next = safeNext(text(formData, "next"), "/mine");
  const user = findUserByLogin(login);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return { error: "账号或密码不对" };
  }
  if (!user.email_verified_at) {
    const query = new URLSearchParams({ sent: "1", email: user.email, next, pending: "1" });
    redirect(`/activate?${query}`);
  }
  await setSession(user.id);
  revalidateAll();
  redirect(next);
}

export async function logoutAction() {
  await clearSession();
  revalidateAll();
  redirect("/");
}

export async function uploadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "请先登录再投稿" };
  if (countWorksByAuthor(user.id) >= 30) return { error: "每人最多保存 30 篇稿件" };

  const title = text(formData, "title");
  const summary = text(formData, "summary");
  const kind = text(formData, "kind");
  const category = text(formData, "category");
  const priceRaw = text(formData, "price");
  const content = text(formData, "content").replace(/\r\n/g, "\n");

  if (title.length < 2 || title.length > 30 || /[\r\n]/.test(title)) {
    return { error: "标题请写 2 到 30 个字" };
  }
  if (summary.length < 10 || summary.length > 100) {
    return { error: "简介请写 10 到 100 个字" };
  }
  if (kind !== "script" && kind !== "novel") return { error: "请选择短剧或小说" };
  if (!isCategory(category)) return { error: "请选择分类" };
  if (priceRaw && !/^\d{1,2}$/.test(priceRaw)) return { error: "定价请填 0 到 99 的整数" };
  const price = priceRaw ? Number(priceRaw) : 0;
  if (price > 99) return { error: "定价请填 0 到 99 的整数" };
  const words = countWords(content);
  if (words < 200) return { error: "正文至少 200 字，才能送去审核" };
  if (words > 20000) return { error: "正文请控制在 2 万字以内" };

  const review = await reviewWork({
    title,
    kind: kind as Kind,
    category,
    summary,
    content,
  });

  let id = 0;
  try {
    id = insertWork({
      title,
      kind: kind as Kind,
      category,
      summary,
      content,
      authorId: user.id,
      price,
      review,
      wordCount: words,
    });
  } catch (error) {
    if (error instanceof WorkLimitError) return { error: error.message };
    return { error: "保存失败，请稍后再试" };
  }

  revalidateAll();
  redirect(`/works/${id}`);
}

export async function unlockAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "请先登录" };
  const workId = Number(text(formData, "workId"));
  if (!Number.isInteger(workId) || workId <= 0) return { error: "找不到这篇" };
  const work = getWorkDetail(workId);
  if (!work || work.status !== "published") return { error: "这篇还不能解锁" };
  if (work.author_id === user.id) return { error: "这是你自己的稿件" };
  if (work.price <= 0) return { error: "这篇是免费的" };
  if (hasUnlock(user.id, work.id)) {
    revalidateAll();
    redirect(`/works/${work.id}`);
  }
  const result = unlockWork(user.id, work.id, work.price, work.title);
  if (!result.ok) return { error: result.error };
  revalidateAll();
  redirect(`/works/${work.id}`);
}

export async function rechargeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "请先登录" };
  const pack = findPack(text(formData, "pack"));
  if (!pack) return { error: "请选择充值档位" };
  rechargeCoins(user.id, pack.coins, `演示充值 ${pack.coins} 金币`);
  revalidateAll();
  redirect("/wallet?ok=1");
}

export async function resendActivationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = text(formData, "email").toLowerCase();
  const next = safeNext(text(formData, "next"), "/mine");
  if (!isEmail(email)) return { error: "邮箱格式不对" };
  const user = findUserByEmail(email);
  if (!user) return { error: "没有这个待激活的邮箱" };
  if (user.email_verified_at) return { error: "这个邮箱已经激活，直接登录" };
  const mailed = await mailActivation(user.id, email, user.username);
  if (mailed.error) return { error: mailed.error };
  const query = new URLSearchParams({ sent: "1", email, next, resent: "1" });
  redirect(`/activate?${query}`);
}

export async function activateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = text(formData, "token");
  const next = safeNext(text(formData, "next"), "/mine");
  const result = consumeActivationToken(token);
  if (!result.ok) return { error: result.error };
  await setSession(result.userId);
  revalidateAll();
  const join = next.includes("?") ? "&" : "?";
  redirect(`${next}${join}activated=1`);
}

export async function checkinAction(_prev: ActionState): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "请先登录" };
  const result = checkIn(user.id);
  if (!result.ok) return { error: result.error };
  revalidateAll();
  redirect("/checkin?ok=1");
}
