import { ensureSvgCover, readCover } from "@/lib/cover";
import { getWorkDetail } from "@/lib/db";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: raw } = await context.params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return new Response(null, { status: 404 });
  const work = getWorkDetail(id);
  if (!work) return new Response(null, { status: 404 });
  ensureSvgCover({
    id: work.id,
    title: work.title,
    summary: work.summary,
    category: work.category,
    kind: work.kind,
    grade: work.grade,
    content: work.content,
  });
  const cover = readCover(id);
  if (!cover) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(cover.body), {
    headers: {
      "Content-Type": cover.type,
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
