"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isCategory } from "@/lib/categories";
import { findPack } from "@/lib/coins";
import { normalizeInviteCode } from "@/lib/codes";
import { countWords, safeNext } from "@/lib/format";
import { reviewWork } from "@/lib/ai";
import { createReviewCover } from "@/lib/cover";
import { clearSession, getCurrentUser, setSession } from "@/lib/auth";
import {
  checkIn,
  consumeActivationToken,
  countWorksByAuthor,
  createDiscussion,
  createRequirement,
  deleteDiscussion,
  deliverRequirement,
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
  setRequirementMaking,
  unlockWork,
  WorkLimitError,
} from "@/lib/db";
import { sendActivationMail } from "@/lib/mail";
import { requestOrigin } from "@/lib/origin";
import { hashPassword, verifyPassword } from "@/lib/password";
import { MIN_REQUIREMENT_YUAN } from "@/lib/pricing";
import { parseBountyYuan } from "@/lib/requirements";
import type { ActionState, Kind } from "@/lib/types";

function isAdminSecret(raw: string) {
  const expected = process.env.ADMIN_SECRET?.trim();
  return Boolean(expected && raw && raw === expected);
}

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
  if (kind !== "script") return { error: "目前只收短剧剧本" };
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

  await createReviewCover({
    id,
    title,
    summary,
    category,
    kind: kind as Kind,
    grade: review.grade,
    content,
  });
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

export async function createRequirementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "请先登录" };

  const title = text(formData, "title");
  const kindRaw = text(formData, "kind");
  const category = text(formData, "category");
  const brief = text(formData, "brief");
  const referenceText = text(formData, "reference");
  const bountyYuan = parseBountyYuan(formData.get("bounty"));

  if (title.length < 2 || title.length > 80) return { error: "标题 2–80 字" };
  if (kindRaw !== "script") return { error: "目前只征短剧剧本" };
  if (!isCategory(category)) return { error: "请选择分类" };
  if (brief.length < 20 || brief.length > 4000) return { error: "内容要求 20–4000 字" };
  if (referenceText.length > 500) return { error: "对标说明最多 500 字" };
  if (bountyYuan == null) return { error: `赏金至少 ¥${MIN_REQUIREMENT_YUAN}，且为整数` };

  const id = createRequirement({
    userId: user.id,
    title,
    kind: kindRaw as Kind,
    category,
    brief,
    referenceText,
    bountyYuan,
  });
  revalidatePath("/requirements");
  revalidatePath("/mine");
  redirect(`/requirements/${id}?pay=1`);
}

export async function deliverRequirementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const secret = text(formData, "secret");
  if (!isAdminSecret(secret)) return { error: "站长口令不对" };
  const requirementId = Number(text(formData, "requirementId"));
  const workId = Number(text(formData, "workId"));
  if (!Number.isInteger(requirementId) || requirementId <= 0) return { error: "缺少征稿 ID" };
  if (!Number.isInteger(workId) || workId <= 0) return { error: "请填写作品 ID" };
  const result = deliverRequirement(requirementId, workId);
  if (!result.ok) return { error: result.error };
  revalidatePath("/requirements");
  revalidatePath(`/requirements/${requirementId}`);
  revalidatePath("/ops/requirements");
  revalidatePath("/mine");
  redirect(`/ops/requirements?key=${encodeURIComponent(secret)}&ok=1`);
}

export async function markRequirementMakingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const secret = text(formData, "secret");
  if (!isAdminSecret(secret)) return { error: "站长口令不对" };
  const requirementId = Number(text(formData, "requirementId"));
  if (!Number.isInteger(requirementId) || requirementId <= 0) return { error: "缺少征稿 ID" };
  const result = setRequirementMaking(requirementId);
  if (!result.ok) return { error: result.error };
  revalidatePath("/requirements");
  revalidatePath(`/requirements/${requirementId}`);
  revalidatePath("/ops/requirements");
  redirect(`/ops/requirements?key=${encodeURIComponent(secret)}`);
}

export async function createDiscussionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "请先登录" };

  const body = text(formData, "body");
  const title = text(formData, "title");
  const workRaw = text(formData, "workId");
  const next = safeNext(text(formData, "next"), "/community");

  let workId: number | null = null;
  if (workRaw) {
    const id = Number(workRaw);
    if (!Number.isInteger(id) || id <= 0) return { error: "作品无效" };
    const work = getWorkDetail(id);
    if (!work || work.status !== "published") return { error: "只能引用已上架剧本" };
    workId = id;
  }

  // 作品页留言：有 workId、无标题；社区发帖：要标题，且必须引用一部剧本
  const isWorkComment = Boolean(workId) && !title;
  if (isWorkComment) {
    if (body.length < 2 || body.length > 1000) return { error: "留言 2–1000 字" };
  } else {
    if (!workId) return { error: "请先搜索并引用一部剧本" };
    if (title.length < 2 || title.length > 60) return { error: "标题 2–60 字" };
    if (body.length < 2 || body.length > 2000) return { error: "正文 2–2000 字" };
  }

  createDiscussion({
    userId: user.id,
    workId,
    title: isWorkComment ? "" : title,
    body,
  });
  revalidatePath("/community");
  if (workId) revalidatePath(`/works/${workId}`);
  redirect(next);
}

export async function deleteDiscussionAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/community");
  const id = Number(text(formData, "id"));
  const next = safeNext(text(formData, "next"), "/community");
  if (!Number.isInteger(id) || id <= 0) redirect(next);
  const result = deleteDiscussion(id, user.id);
  if (result.ok) {
    revalidatePath("/community");
    revalidatePath("/", "layout");
  }
  redirect(next);
}
