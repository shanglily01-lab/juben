import { ensureSvgCover, upgradeCoverWithAi } from "@/lib/cover";
import { extractWorkMeta, parseKind } from "@/lib/extract-meta";
import { countWords } from "@/lib/format";
import { countWorksByAuthor, insertWork, WorkLimitError } from "@/lib/db";
import type { Kind } from "@/lib/types";

export const UPLOAD_MD_MAX_BYTES = 5 * 1024 * 1024;
export const UPLOAD_MD_MIN_WORDS = 200;
export const UPLOAD_MD_MAX_WORDS = 500_000;
export const UPLOAD_MD_MAX_WORKS = 50;

export type UploadMdOk = {
  ok: true;
  workId: number;
  title: string;
  kind: string;
  category: string;
  wordCount: number;
  url: string;
};

export type UploadMdErr = {
  ok: false;
  error: string;
  code?: "unauthorized" | "limit" | "too_short" | "too_long" | "empty" | "save_failed";
};

export type PublishMarkdownOptions = {
  /** API / 开放上传时跳过每人 50 篇 */
  bypassAuthorLimit?: boolean;
  /** 强制体裁：script=短剧，novel=小说 */
  kind?: Kind | string;
};

/** 登录用户投稿 Markdown 正文：校验 → 抽元数据 → 上架 → 封面。 */
export async function publishMarkdownForUser(
  user: { id: number },
  rawContent: string,
  options: PublishMarkdownOptions = {},
): Promise<UploadMdOk | UploadMdErr> {
  const content = String(rawContent || "").replace(/\r\n/g, "\n").trim();
  if (!content) return { ok: false, error: "正文不能为空", code: "empty" };

  if (!options.bypassAuthorLimit && countWorksByAuthor(user.id) >= UPLOAD_MD_MAX_WORKS) {
    return { ok: false, error: `每人最多保存 ${UPLOAD_MD_MAX_WORKS} 篇稿件`, code: "limit" };
  }

  const words = countWords(content);
  if (words < UPLOAD_MD_MIN_WORDS) {
    return { ok: false, error: `正文至少 ${UPLOAD_MD_MIN_WORDS} 字`, code: "too_short" };
  }
  if (words > UPLOAD_MD_MAX_WORDS) {
    return { ok: false, error: `正文请控制在 ${UPLOAD_MD_MAX_WORDS / 10000} 万字以内`, code: "too_long" };
  }

  const forcedKind = parseKind(options.kind);
  const meta = await extractWorkMeta(content, { kind: forcedKind });
  const { title, summary, category, kind } = meta;
  const review = {
    score: 6.5,
    grade: "乙",
    decision: "approve" as const,
    source: "local" as const,
    summary: `《${title}》已上架。`,
    advice: ["批量上架阶段直接发布；稍后可再统一精审与换封面。"],
    dimensions: { plot: 6.5, character: 6.5, pacing: 6.5, language: 6.5, completeness: 6.5 },
  };

  let id = 0;
  try {
    id = insertWork({
      title,
      kind,
      category,
      summary,
      content,
      authorId: user.id,
      price: 0,
      review,
      wordCount: words,
      status: "published",
      bypassAuthorLimit: options.bypassAuthorLimit,
    });
  } catch (error) {
    if (error instanceof WorkLimitError) {
      return { ok: false, error: error.message, code: "limit" };
    }
    return { ok: false, error: "保存失败，请稍后再试", code: "save_failed" };
  }

  const coverInput = {
    id,
    title,
    summary,
    category,
    kind,
    grade: review.grade,
    content,
  };
  // 先落模板封面保证立刻有图；后台自动 AI 出图替换，无需人工上传。
  try {
    ensureSvgCover(coverInput, true);
  } catch (error) {
    console.error("[cover] svg failed", id, error instanceof Error ? error.message : error);
  }
  void upgradeCoverWithAi(coverInput).catch((error) => {
    console.error("[cover] ai upgrade failed", id, error instanceof Error ? error.message : error);
  });

  return {
    ok: true,
    workId: id,
    title,
    kind,
    category,
    wordCount: words,
    url: `/works/${id}`,
  };
}

export function looksLikeMarkdownFilename(name: string) {
  return /\.(md|markdown|txt)$/i.test(name || "");
}
