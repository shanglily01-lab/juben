import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import {
  looksLikeMarkdownFilename,
  publishMarkdownForUser,
  UPLOAD_MD_MAX_BYTES,
  UPLOAD_MD_MAX_WORDS,
  UPLOAD_MD_MAX_WORKS,
  UPLOAD_MD_MIN_WORDS,
} from "@/lib/upload-md";

export const runtime = "nodejs";

/** 预留：上传 Markdown 剧本接口说明。 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/upload/md",
    method: "POST",
    auth: "需要已登录会话 Cookie",
    limits: {
      maxBytes: UPLOAD_MD_MAX_BYTES,
      minWords: UPLOAD_MD_MIN_WORDS,
      maxWords: UPLOAD_MD_MAX_WORDS,
      maxWorksPerUser: UPLOAD_MD_MAX_WORKS,
      accept: [".md", ".markdown", ".txt", "text/markdown", "text/plain"],
    },
    body: {
      multipart: {
        file: "Markdown 文件字段名 file（也可用 content 文本字段）",
        content: "可选，纯文本正文",
      },
      json: {
        content: "string，Markdown 正文",
      },
    },
    response: {
      ok: true,
      workId: "number",
      title: "string",
      url: "/works/{id}",
    },
  });
}

async function readContent(req: Request): Promise<{ content: string; error?: string }> {
  const type = (req.headers.get("content-type") || "").toLowerCase();

  if (type.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as { content?: string } | null;
    return { content: String(body?.content || "") };
  }

  if (type.includes("multipart/form-data") || type.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    const textField = String(form.get("content") || "");
    const file = form.get("file");
    if (file instanceof File) {
      if (file.size > UPLOAD_MD_MAX_BYTES) {
        return { content: "", error: `文件请控制在 ${UPLOAD_MD_MAX_BYTES / (1024 * 1024)}MB 以内` };
      }
      if (file.name && !looksLikeMarkdownFilename(file.name) && file.type && !/^text\//i.test(file.type)) {
        return { content: "", error: "请上传 .md / .markdown / .txt 文件" };
      }
      const text = await file.text();
      return { content: text || textField };
    }
    return { content: textField };
  }

  // 裸 text/markdown / text/plain
  if (type.includes("text/") || type === "") {
    const text = await req.text();
    if (text.length > UPLOAD_MD_MAX_BYTES) {
      return { content: "", error: `正文请控制在 ${UPLOAD_MD_MAX_BYTES / (1024 * 1024)}MB 以内` };
    }
    return { content: text };
  }

  return { content: "", error: "请使用 multipart/form-data、application/json 或 text/markdown" };
}

/**
 * POST /api/upload/md
 * 预留给脚本/外部工具上传 Markdown 剧本；与网页投稿同一套上架逻辑。
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "请先登录再投稿", code: "unauthorized" },
      { status: 401 },
    );
  }

  let parsed: { content: string; error?: string };
  try {
    parsed = await readContent(req);
  } catch {
    return NextResponse.json({ ok: false, error: "无法读取请求正文", code: "empty" }, { status: 400 });
  }

  if (parsed.error) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const result = await publishMarkdownForUser(user, parsed.content);
  if (!result.ok) {
    const status =
      result.code === "unauthorized"
        ? 401
        : result.code === "limit"
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
