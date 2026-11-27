"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isCategory } from "@/lib/categories";
import { normalizeInviteCode } from "@/lib/codes";
import { reviewWork } from "@/lib/ai";
import { clearSession, getAdminUser, getCurrentUser, setSession } from "@/lib/auth";
import { hasAiCoverConfig, regenerateCoverWithAi, removeCoverFiles, saveUploadedCover } from "@/lib/cover";
import { extractWorkMeta } from "@/lib/extract-meta";
import { countWords, gradeOf, safeNext } from "@/lib/format";
import { publishMarkdownForUser, UPLOAD_MD_MAX_WORDS, UPLOAD_MD_MIN_WORDS } from "@/lib/upload-md";
import {
  buyoutWorkWithCoins,
  checkIn,
  consumeActivationToken,
  createDiscussion,
  createRequirement,
  deleteDiscussion,
  deleteRejectedWork,
  deleteWorkAsAdmin,
  replaceWorkContent,
  deliverRequirement,
  findUserByEmail,
  findUserByLogin,
  getRequirement,
  getWorkDetail,
  hasUnlock,
  hasWorkBuyout,
  InvalidInviteError,
  isWorkBuyoutTaken,
  discardUnusedActivationToken,
  issueActivationToken,
  payRequirementWithCoins,
  registerUser,
  setRequirementMaking,
  unlockWork,
  updateWorkReview,
} from "@/lib/db";
import { splitEpisodes } from "@/lib/episodes";
import { sendActivationMail } from "@/lib/mail";
import { requestOrigin } from "@/lib/origin";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  BUYOUT_COINS,
  MIN_REQUIREMENT_COINS,
  unlockCoinsFromScore,
} from "@/lib/pricing";
import { parseBountyCoins } from "@/lib/requirements";
import type { ActionState, Kind, Review } from "@/lib/types";

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
  if (username.toLowerCase() === "admin" || email === "admin@moben.local") {
    return { error: "这个名字不可用" };
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

  const kindRaw = text(formData, "kind");
  if (kindRaw && kindRaw !== "script" && kindRaw !== "novel") {
    return { error: "请选择短剧或小说" };
  }

  const result = await publishMarkdownForUser(user, text(formData, "content"), {
    kind: kindRaw || undefined,
  });
  if (!result.ok) return { error: result.error };

  revalidateAll();
  redirect(result.url);
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
  if (isWorkBuyoutTaken(work.id) && !hasWorkBuyout(user.id, work.id)) {
    return { error: "这篇已被买断" };
  }
  if (hasUnlock(user.id, work.id) || hasWorkBuyout(user.id, work.id)) {
    revalidateAll();
    redirect(`/works/${work.id}`);
  }
  const episodes = Math.max(1, Number(work.episode_count) || splitEpisodes(work.content).length);
  const coins = unlockCoinsFromScore(work.score, episodes);
  const result = unlockWork(user.id, work.id, coins, work.title);
  if (!result.ok) return { error: result.error };
  revalidateAll();
  redirect(`/works/${work.id}`);
}

export async function buyoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "请先登录" };
  const workId = Number(text(formData, "workId"));
  if (!Number.isInteger(workId) || workId <= 0) return { error: "找不到这篇" };
  const work = getWorkDetail(workId);
  if (!work || work.status !== "published") return { error: "这篇还不能买断" };
  if (work.author_id === user.id) return { error: "这是你自己的稿件" };
  if (work.price <= 0) return { error: "免费篇无需买断" };
  const result = buyoutWorkWithCoins(user.id, work.id, work.title, BUYOUT_COINS);
  if (!result.ok) return { error: result.error };
  revalidateAll();
  redirect(`/works/${work.id}`);
}

export async function payRequirementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "请先登录" };
  const requirementId = Number(text(formData, "requirementId"));
  if (!Number.isInteger(requirementId) || requirementId <= 0) return { error: "缺少征稿" };
  const requirement = getRequirement(requirementId);
  if (!requirement) return { error: "征稿不存在" };
  if (requirement.user_id !== user.id) return { error: "只能支付自己的征稿" };
  const result = payRequirementWithCoins(user.id, requirementId);
  if (!result.ok) return { error: result.error };
  revalidatePath("/requirements");
  revalidatePath(`/requirements/${requirementId}`);
  revalidatePath("/mine");
  revalidatePath("/wallet");
  redirect(`/requirements/${requirementId}`);
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
  const bountyCoins = parseBountyCoins(formData.get("bounty"));

  if (title.length < 2 || title.length > 80) return { error: "标题 2–80 字" };
  if (kindRaw !== "script") return { error: "目前只征短剧剧本" };
  if (!isCategory(category)) return { error: "请选择分类" };
  if (brief.length < 20 || brief.length > 4000) return { error: "内容要求 20–4000 字" };
  if (referenceText.length > 500) return { error: "对标说明最多 500 字" };
  if (bountyCoins == null) return { error: `赏金至少 ${MIN_REQUIREMENT_COINS} 金，且为整数` };

  const id = createRequirement({
    userId: user.id,
    title,
    kind: kindRaw as Kind,
    category,
    brief,
    referenceText,
    bountyYuan: bountyCoins,
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

/** 作者删除未过审稿件。 */
export async function deleteRejectedWorkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "请先登录" };
  const workId = Number(text(formData, "workId"));
  if (!Number.isInteger(workId) || workId <= 0) return { error: "找不到这篇" };
  const result = deleteRejectedWork(workId, user.id);
  if (!result.ok) return { error: result.error };
  removeCoverFiles(workId);
  revalidateAll();
  redirect("/mine");
}

/** 管理员删除任意剧本或小说。 */
export async function adminDeleteWorkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "需要管理员账号" };
  const workId = Number(text(formData, "workId"));
  if (!Number.isInteger(workId) || workId <= 0) return { error: "找不到这篇" };
  const result = deleteWorkAsAdmin(workId);
  if (!result.ok) return { error: result.error };
  removeCoverFiles(workId);
  revalidateAll();
  redirect("/ops/works");
}

/** 管理员：用 AI 自动生成封面（无需上传图片）。 */
export async function adminGenerateCoverAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "需要管理员账号" };
  const workId = Number(text(formData, "workId"));
  if (!Number.isInteger(workId) || workId <= 0) return { error: "找不到这篇" };
  const work = getWorkDetail(workId);
  if (!work) return { error: "找不到这篇" };

  if (!hasAiCoverConfig()) {
    return { error: "服务器未配置 AI 出图：请设置 AI_IMAGE_MODEL 与 AI_API_KEY / AI_IMAGE_API_KEY" };
  }

  const result = await regenerateCoverWithAi({
    id: work.id,
    title: work.title,
    summary: work.summary,
    category: work.category,
    kind: work.kind,
    grade: work.grade,
    content: work.content,
  });
  if (!result.ok) return { error: result.error };

  revalidatePath(`/works/${workId}`);
  revalidatePath("/ops/works");
  revalidatePath("/");
  revalidatePath("/browse");
  redirect(`/works/${workId}`);
}

/** 管理员上传自定义封面（可选，一般用 AI 即可）。 */
export async function adminUploadCoverAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "需要管理员账号" };
  const workId = Number(text(formData, "workId"));
  if (!Number.isInteger(workId) || workId <= 0) return { error: "找不到这篇" };
  const work = getWorkDetail(workId);
  if (!work) return { error: "找不到这篇" };

  const file = formData.get("cover");
  if (!(file instanceof File) || file.size <= 0) return { error: "请选择封面图片" };
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    saveUploadedCover(workId, bytes, file.type || "image/png");
  } catch (error) {
    return { error: error instanceof Error ? error.message : "封面保存失败" };
  }

  revalidatePath(`/works/${workId}`);
  revalidatePath("/ops/works");
  revalidatePath("/");
  revalidatePath("/browse");
  redirect(`/works/${workId}?cover=ok`);
}

/** 管理员用新的 Markdown 覆盖这篇的正文，作品编号和购买记录不变。 */
export async function adminReplaceContentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "需要管理员账号" };
  const workId = Number(text(formData, "workId"));
  if (!Number.isInteger(workId) || workId <= 0) return { error: "找不到这篇" };
  const work = getWorkDetail(workId);
  if (!work) return { error: "找不到这篇" };

  const content = text(formData, "content").replace(/\r\n/g, "\n").trim();
  if (!content) return { error: "正文不能为空" };
  const words = countWords(content);
  if (words < UPLOAD_MD_MIN_WORDS) return { error: `正文至少 ${UPLOAD_MD_MIN_WORDS} 字` };
  if (words > UPLOAD_MD_MAX_WORDS) {
    return { error: `正文请控制在 ${UPLOAD_MD_MAX_WORDS / 10000} 万字以内` };
  }

  const kindRaw = text(formData, "kind");
  const kind = kindRaw === "script" || kindRaw === "novel" ? kindRaw : work.kind === "novel" ? "novel" : "script";
  const meta = await extractWorkMeta(content, { kind });
  const result = replaceWorkContent(workId, {
    title: meta.title,
    kind: meta.kind,
    category: meta.category,
    summary: meta.summary,
    content,
    wordCount: words,
  });
  if (!result.ok) return { error: result.error };

  revalidatePath(`/works/${workId}`);
  revalidatePath("/ops/works");
  revalidatePath("/");
  revalidatePath("/browse");
  redirect(`/works/${workId}?replaced=1`);
}

/** 管理员：重新跑一遍审核（AI/规则）。 */
export async function adminRereviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "需要管理员账号" };
  const workId = Number(text(formData, "workId"));
  if (!Number.isInteger(workId) || workId <= 0) return { error: "找不到这篇" };
  const work = getWorkDetail(workId);
  if (!work) return { error: "找不到这篇" };

  const review = await reviewWork({
    title: work.title,
    kind: work.kind,
    category: work.category,
    summary: work.summary,
    content: work.content,
  });
  review.grade = gradeOf(review.score);
  const status = review.decision === "approve" ? "published" : "rejected";
  const result = updateWorkReview(workId, { review, status });
  if (!result.ok) return { error: result.error };

  revalidatePath(`/works/${workId}`);
  revalidatePath("/ops/works");
  revalidatePath("/");
  revalidatePath("/browse");
  redirect(`/works/${workId}`);
}

/** 管理员：手工改分、档位、上架状态。 */
export async function adminUpdateWorkAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await getAdminUser();
  if (!admin) return { error: "需要管理员账号" };
  const workId = Number(text(formData, "workId"));
  if (!Number.isInteger(workId) || workId <= 0) return { error: "找不到这篇" };
  const work = getWorkDetail(workId);
  if (!work) return { error: "找不到这篇" };

  const scoreRaw = Number(text(formData, "score"));
  const score = Number.isFinite(scoreRaw) ? Math.max(1, Math.min(10, Math.round(scoreRaw * 10) / 10)) : work.score;
  const statusRaw = text(formData, "status");
  const status =
    statusRaw === "published" || statusRaw === "rejected" || statusRaw === "pending"
      ? statusRaw
      : (work.status as "published" | "rejected" | "pending");
  const paid = text(formData, "paid") === "1";
  const kindRaw = text(formData, "kind");
  const kind = kindRaw === "script" || kindRaw === "novel" ? kindRaw : undefined;
  const note = text(formData, "note").slice(0, 180);
  const grade = gradeOf(score);

  let base: Review;
  try {
    base = JSON.parse(work.review_json) as Review;
  } catch {
    base = {
      score,
      grade,
      decision: status === "rejected" ? "reject" : "approve",
      source: "local",
      summary: note || work.summary,
      advice: [],
      dimensions: { plot: score, character: score, pacing: score, language: score, completeness: score },
    };
  }

  const review: Review = {
    ...base,
    score,
    grade,
    decision: status === "rejected" ? "reject" : "approve",
    source: "local",
    summary: note || base.summary || `《${work.title}》站长复审为 ${grade}。`,
  };

  const result = updateWorkReview(workId, { review, status, price: paid ? 1 : 0, kind });
  if (!result.ok) return { error: result.error };

  revalidatePath(`/works/${workId}`);
  revalidatePath("/ops/works");
  revalidatePath("/");
  revalidatePath("/browse");
  redirect(`/works/${workId}`);
}
