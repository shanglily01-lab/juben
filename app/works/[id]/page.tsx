import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Reader } from "@/components/Reader";
import { ReviewCard } from "@/components/ReviewCard";
import { UnlockForm } from "@/components/UnlockForm";
import { getCurrentUser } from "@/lib/auth";
import { categoryName } from "@/lib/categories";
import { getWorkDetail, hasUnlock } from "@/lib/db";
import { formatDate, kindLabel, parseReview, previewMarkdown, priceLabel } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const work = getWorkDetail(Number(id));
  const user = await getCurrentUser();
  if (!work || (work.status !== "published" && user?.id !== work.author_id)) return { title: "未找到" };
  return { title: work.title, description: work.summary };
}

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const work = getWorkDetail(id);
  const user = await getCurrentUser();
  if (!work) notFound();
  const isAuthor = user?.id === work.author_id;
  if (work.status !== "published" && !isAuthor) notFound();

  const unlocked = user ? hasUnlock(user.id, work.id) : false;
  const canRead = work.price <= 0 || unlocked || isAuthor;
  const review = parseReview(work.review_json);

  return (
    <div className={canRead ? "wrap page" : "wrap page pay-space"}>
      <div className="work-layout">
        <header className="work-head">
          <p className="kicker">
            {kindLabel(work.kind)} · {categoryName(work.category)}
          </p>
          <h1>{work.title}</h1>
          <div className="meta">
            <span>{work.author}</span>
            <span>{work.word_count} 字</span>
            <span>{priceLabel(work.price)}</span>
            <span>{formatDate(work.created_at)}</span>
            {unlocked ? <span>已解锁</span> : null}
          </div>
          <p className="intro" style={{ marginTop: 10 }}>
            {work.summary}
          </p>
          {work.status !== "published" ? <p className="banner">这篇没有通过审核，只有你自己看得到。</p> : null}
        </header>
        {review ? <ReviewCard review={review} /> : null}
        <div className="work-main">
          <Reader markdown={canRead ? work.content : previewMarkdown(work.content)} cut={!canRead} />
        </div>
      </div>
      {!canRead ? (
        <UnlockForm
          workId={work.id}
          price={work.price}
          coins={user?.coins ?? 0}
          loggedIn={Boolean(user)}
          loginHref={`/login?next=${encodeURIComponent(`/works/${work.id}`)}`}
        />
      ) : null}
    </div>
  );
}
