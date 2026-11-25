import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getWorkBuyoutUserId, getWorkDetail, hasUnlock, hasWorkBuyout } from "@/lib/db";
import { kindLabel } from "@/lib/format";

export const runtime = "nodejs";

function asciiFallback(name: string) {
  const cleaned = name.replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return cleaned || "script";
}

function attachmentName(title: string) {
  const base = title.replace(/[\\/:*?"<>|]+/g, "_").trim() || "剧本";
  return `${base}.md`;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: raw } = await ctx.params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, msg: "找不到这篇" }, { status: 404 });
  }

  const work = getWorkDetail(id);
  if (!work) return NextResponse.json({ ok: false, msg: "找不到这篇" }, { status: 404 });

  const user = await getCurrentUser();
  const isAuthor = user?.id === work.author_id;
  if (work.status !== "published" && !isAuthor) {
    return NextResponse.json({ ok: false, msg: "找不到这篇" }, { status: 404 });
  }

  const exclusiveOwnerId = getWorkBuyoutUserId(work.id);
  const taken = exclusiveOwnerId != null;
  const iOwnBuyout = Boolean(user && exclusiveOwnerId === user.id);
  const unlocked = user ? hasUnlock(user.id, work.id) : false;
  const canDownload =
    isAuthor || iOwnBuyout || (!taken && (work.price <= 0 || unlocked || (user ? hasWorkBuyout(user.id, work.id) : false)));
  if (!canDownload) {
    return NextResponse.json(
      { ok: false, msg: taken ? "这篇已被他人买断，无法下载" : "请先购买后再下载" },
      { status: 403 },
    );
  }

  const filename = attachmentName(work.title);
  const body = [
    `# ${work.title}`,
    "",
    `> ${kindLabel(work.kind)} · ${work.author} · ${work.word_count} 字`,
    "",
    work.summary ? `${work.summary}\n` : "",
    work.content.trim(),
    "",
  ].join("\n");

  const bytes = new TextEncoder().encode(body);
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${asciiFallback(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
