import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { findUserById, findUserByLogin } from "@/lib/db";
import {
  looksLikeMarkdownFilename,
  publishMarkdownForUser,
  UPLOAD_MD_MAX_BYTES,
  UPLOAD_MD_MAX_WORDS,
  UPLOAD_MD_MAX_WORKS,
  UPLOAD_MD_MIN_WORDS,
} from "@/lib/upload-md";

export const runtime = "nodejs";

type ParsedBody = {
  content: string;
  author?: string;
  authorId?: number;
  error?: string;
};

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function configuredUploadToken() {
  return (process.env.UPLOAD_API_TOKEN || process.env.ADMIN_SECRET || "").trim();
}

function readBearerOrHeaderToken(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (/^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, "").trim();
  return (req.headers.get("x-upload-token") || "").trim();
}

function tokenAuthorized(req: Request) {
  const expected = configuredUploadToken();
  const got = readBearerOrHeaderToken(req);
  return Boolean(expected && got && safeEqual(got, expected));
}

function resolveAuthorUser(input: { author?: string; authorId?: number }) {
  if (input.authorId && Number.isInteger(input.authorId) && input.authorId > 0) {
    const byId = findUserById(input.authorId);
    if (byId?.email_verified_at) return { id: byId.id, username: byId.username };
  }
  const login = (input.author || process.env.UPLOAD_AUTHOR_LOGIN || "").trim();
  if (login) {
    const byLogin = findUserByLogin(login);
    if (byLogin?.email_verified_at) return { id: byLogin.id, username: byLogin.username };
  }
  return null;
}

/** 预留：上传 Markdown 剧本接口说明。 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/upload/md",
    method: "POST",
    auth: [
      "已登录会话 Cookie",
      "Authorization: Bearer <UPLOAD_API_TOKEN>（或 ADMIN_SECRET）",
      "X-Upload-Token: <UPLOAD_API_TOKEN>",
    ],
    author: {
      session: "归属当前登录用户",
      token:
        "可用 JSON/表单 author / authorId，或环境变量 UPLOAD_AUTHOR_LOGIN（已激活用户的用户名或邮箱）",
    },
    limits: {
      maxBytes: UPLOAD_MD_MAX_BYTES,
      minWords: UPLOAD_MD_MIN_WORDS,
      maxWords: UPLOAD_MD_MAX_WORDS,
      maxWorksPerUser: UPLOAD_MD_MAX_WORKS,
      tokenBypassAuthorLimit: true,
      accept: [".md", ".markdown", ".txt", "text/markdown", "text/plain"],
    },
    examples: {
      curlFile:
        'curl -X POST "$ORIGIN/api/upload/md" -H "Authorization: Bearer $UPLOAD_API_TOKEN" -F "file=@./剧本.md"',
      curlJson:
        'curl -X POST "$ORIGIN/api/upload/md" -H "Authorization: Bearer $UPLOAD_API_TOKEN" -H "Content-Type: application/json" -d "{\"content\":\"……正文至少200字……\",\"author\":\"你的用户名\"}"',
    },
    response: {
      ok: true,
      workId: "number",
      title: "string",
      url: "/works/{id}",
    },
  });
}

async function readContent(req: Request): Promise<ParsedBody> {
  const type = (req.headers.get("content-type") || "").toLowerCase();
  const headerAuthor = (req.headers.get("x-author") || "").trim();
  const headerAuthorId = Number(req.headers.get("x-author-id") || 0);

  if (type.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as {
      content?: string;
      author?: string;
      authorId?: number;
    } | null;
    return {
      content: String(body?.content || ""),
      author: String(body?.author || headerAuthor || "").trim() || undefined,
      authorId: Number(body?.authorId || headerAuthorId) || undefined,
    };
  }

  if (type.includes("multipart/form-data") || type.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    const textField = String(form.get("content") || "");
    const author = String(form.get("author") || headerAuthor || "").trim() || undefined;
    const authorId = Number(form.get("authorId") || headerAuthorId) || undefined;
    const file = form.get("file");
    if (file instanceof File) {
      if (file.size > UPLOAD_MD_MAX_BYTES) {
        return { content: "", error: `文件请控制在 ${UPLOAD_MD_MAX_BYTES / (1024 * 1024)}MB 以内` };
      }
      if (file.name && !looksLikeMarkdownFilename(file.name) && file.type && !/^text\//i.test(file.type)) {
        return { content: "", error: "请上传 .md / .markdown / .txt 文件" };
      }
      const text = await file.text();
      return { content: text || textField, author, authorId };
    }
    return { content: textField, author, authorId };
  }

  if (type.includes("text/") || type === "") {
    const text = await req.text();
    if (text.length > UPLOAD_MD_MAX_BYTES) {
      return { content: "", error: `正文请控制在 ${UPLOAD_MD_MAX_BYTES / (1024 * 1024)}MB 以内` };
    }
    return {
      content: text,
      author: headerAuthor || undefined,
      authorId: headerAuthorId || undefined,
    };
  }

  return { content: "", error: "请使用 multipart/form-data、application/json 或 text/markdown" };
}

/**
 * POST /api/upload/md
 * 支持登录 Cookie，或 UPLOAD_API_TOKEN / ADMIN_SECRET 自动批量上架。
 */
export async function POST(req: Request) {
  const viaToken = tokenAuthorized(req);
  const sessionUser = viaToken ? null : await getCurrentUser();

  let parsed: ParsedBody;
  try {
    parsed = await readContent(req);
  } catch {
    return NextResponse.json({ ok: false, error: "无法读取请求正文", code: "empty" }, { status: 400 });
  }

  if (parsed.error) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  let user: { id: number } | null = sessionUser;
  if (viaToken) {
    user = resolveAuthorUser({ author: parsed.author, authorId: parsed.authorId });
    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Token 上传需指定已激活作者：JSON/表单 author 或 authorId，或配置 UPLOAD_AUTHOR_LOGIN",
          code: "unauthorized",
        },
        { status: 400 },
      );
    }
  } else if (!user) {
    return NextResponse.json(
      { ok: false, error: "请先登录，或使用 Authorization: Bearer <UPLOAD_API_TOKEN>", code: "unauthorized" },
      { status: 401 },
    );
  }

  const result = await publishMarkdownForUser(user, parsed.content, {
    bypassAuthorLimit: viaToken,
  });
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
