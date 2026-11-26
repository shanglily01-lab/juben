import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getMainAuthor } from "@/lib/db";
import { parseKind } from "@/lib/extract-meta";
import {
  looksLikeMarkdownFilename,
  publishMarkdownForUser,
  UPLOAD_MD_MAX_BYTES,
  UPLOAD_MD_MAX_WORDS,
  UPLOAD_MD_MIN_WORDS,
} from "@/lib/upload-md";
import type { Kind } from "@/lib/types";

export const runtime = "nodejs";

/** 开放上传接口说明：无需登录、无需 Token，一律挂主账号。 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/upload/md",
    method: "POST",
    auth: "无需登录、无需 Token；一律挂主账号「大黄书」",
    kind: "script=短剧剧本，novel=小说（推荐上传时显式传入）",
    limits: {
      maxBytes: UPLOAD_MD_MAX_BYTES,
      minWords: UPLOAD_MD_MIN_WORDS,
      maxWords: UPLOAD_MD_MAX_WORDS,
      accept: [".md", ".markdown", ".txt", "text/markdown", "text/plain"],
    },
    body: {
      multipart: {
        file: "Markdown 文件字段名 file（也可用 content）",
        kind: "script | novel",
      },
      json: { content: "string", kind: "script | novel" },
    },
    examples: {
      curlScript:
        'curl -X POST "https://dahuangshu.vip/api/upload/md" -F "kind=script" -F "file=@./剧本.md"',
      curlNovel:
        'curl -X POST "https://dahuangshu.vip/api/upload/md" -F "kind=novel" -F "file=@./小说.md"',
    },
    response: {
      ok: true,
      workId: "number",
      title: "string",
      kind: "script | novel",
      url: "/works/{id}",
    },
  });
}

async function readPayload(
  req: Request,
): Promise<{ content: string; kind?: Kind; error?: string }> {
  const type = (req.headers.get("content-type") || "").toLowerCase();
  const headerKind = parseKind(req.headers.get("x-kind") || "");
  const urlKind = parseKind(new URL(req.url).searchParams.get("kind") || "");

  if (type.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as { content?: string; kind?: string } | null;
    return {
      content: String(body?.content || ""),
      kind: parseKind(body?.kind) || headerKind || urlKind,
    };
  }

  if (type.includes("multipart/form-data") || type.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    const textField = String(form.get("content") || "");
    const kind = parseKind(form.get("kind")) || headerKind || urlKind;
    const file = form.get("file");
    if (file instanceof File) {
      if (file.size > UPLOAD_MD_MAX_BYTES) {
        return { content: "", error: `文件请控制在 ${UPLOAD_MD_MAX_BYTES / (1024 * 1024)}MB 以内` };
      }
      if (file.name && !looksLikeMarkdownFilename(file.name) && file.type && !/^text\//i.test(file.type)) {
        return { content: "", error: "请上传 .md / .markdown / .txt 文件" };
      }
      const text = await file.text();
      return { content: text || textField, kind };
    }
    return { content: textField, kind };
  }

  if (type.includes("text/") || type === "") {
    const text = await req.text();
    if (text.length > UPLOAD_MD_MAX_BYTES) {
      return { content: "", error: `正文请控制在 ${UPLOAD_MD_MAX_BYTES / (1024 * 1024)}MB 以内` };
    }
    return { content: text, kind: headerKind || urlKind };
  }

  return { content: "", error: "请使用 multipart/form-data、application/json 或 text/markdown" };
}

/**
 * POST /api/upload/md
 * 开放上传：直接 POST 正文/文件即可，挂主账号；可用 kind=script|novel 区分体裁。
 */
export async function POST(req: Request) {
  let parsed: { content: string; kind?: Kind; error?: string };
  try {
    parsed = await readPayload(req);
  } catch {
    return NextResponse.json({ ok: false, error: "无法读取请求正文", code: "empty" }, { status: 400 });
  }

  if (parsed.error) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  let author: { id: number };
  try {
    author = getMainAuthor();
  } catch {
    return NextResponse.json({ ok: false, error: "主账号未就绪", code: "save_failed" }, { status: 500 });
  }

  const result = await publishMarkdownForUser(author, parsed.content, {
    bypassAuthorLimit: true,
    kind: parsed.kind,
  });
  if (!result.ok) {
    const status =
      result.code === "limit"
        ? 403
        : result.code === "save_failed"
          ? 500
          : 400;
    return NextResponse.json(result, { status });
  }

  revalidatePath("/");
  revalidatePath("/browse");
  revalidatePath("/mine");
  revalidatePath(`/works/${result.workId}`);

  return NextResponse.json(result, { status: 201 });
}
