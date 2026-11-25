import { NextResponse } from "next/server";

import { lookupPublishedWorks } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") || "";
  if (q.trim().length < 1) {
    return NextResponse.json({ ok: true, works: [] });
  }
  const works = lookupPublishedWorks(q, 12).map((work) => ({
    id: work.id,
    title: work.title,
    author: work.author,
    kind: work.kind,
    grade: work.grade,
    category: work.category,
  }));
  return NextResponse.json({ ok: true, works });
}
