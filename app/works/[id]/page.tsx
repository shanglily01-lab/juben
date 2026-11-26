import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AdminWorkPanel } from "@/components/AdminWorkPanel";
import { DeleteRejectedWorkForm } from "@/components/DeleteRejectedWorkForm";
import { WorkDiscussionForm } from "@/components/DiscussionForm";
import { DiscussionList } from "@/components/DiscussionList";
import { EpisodeNav } from "@/components/EpisodeNav";
import { NoCopy } from "@/components/NoCopy";
import { Reader } from "@/components/Reader";
import { ReviewCard } from "@/components/ReviewCard";
import { WorkPurchase } from "@/components/WorkPurchase";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { categoryName } from "@/lib/categories";
import { coverSrc, hasAiCoverConfig } from "@/lib/cover";
import {
  countDiscussionsByWork,
  getWorkBuyoutUserId,
  getWorkDetail,
  hasUnlock,
  hasWorkBuyout,
  listDiscussionsByWork,
  recordWorkView,
} from "@/lib/db";
import { clampEpisode, splitEpisodes } from "@/lib/episodes";
import { formatDate, formatReads, kindLabel, parseReview, previewMarkdown, priceLabel } from "@/lib/format";
import { coinLabel, unlockCoinsFromScore } from "@/lib/pricing";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const work = getWorkDetail(Number(id));
  const user = await getCurrentUser();
  if (
    !work ||
    (work.status !== "published" && user?.id !== work.author_id && !isAdminUser(user))
  ) {
    return { title: "未找到" };
  }
  return { title: work.title, description: work.summary };
}

export default async function WorkPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ep?: string; cover?: string }>;
}) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const work = getWorkDetail(id);
  const user = await getCurrentUser();
  if (!work) notFound();
  const isAuthor = user?.id === work.author_id;
  const isAdmin = isAdminUser(user);
  if (work.status !== "published" && !isAuthor && !isAdmin) notFound();
  if (work.status === "published") recordWorkView(work.id);

  const exclusiveOwnerId = getWorkBuyoutUserId(work.id);
  const buyoutTaken = exclusiveOwnerId != null;
  const iOwnBuyout = Boolean(user && exclusiveOwnerId === user.id);
  const unlocked = user ? hasUnlock(user.id, work.id) : false;
  // 被他人买断后：仅买断者与作者可读；先前普通购买者也会失去阅读权
  const canRead =
    isAuthor || iOwnBuyout || (!buyoutTaken && (work.price <= 0 || unlocked));
  const canDownload = canRead && (work.price <= 0 || unlocked || iOwnBuyout || isAuthor);
  const review = parseReview(work.review_json);
  const episodeCount = Math.max(1, Number(work.episode_count) || splitEpisodes(work.content).length);
  const unlockCoins = work.price > 0 ? unlockCoinsFromScore(work.score, episodeCount) : 0;
  const priceText = work.price <= 0 ? priceLabel(0) : coinLabel(unlockCoins);
  const showBuy = work.price > 0 && !isAuthor;

  const episodes = splitEpisodes(work.content);
  const query = await searchParams;
  const requested = Number(query.ep || 1);
  const ep = clampEpisode(requested, episodes.length);

  if (!canRead && ep !== 1) {
    redirect(`/works/${work.id}?ep=1`);
  }
  if (Number.isFinite(requested) && requested !== ep && canRead) {
    redirect(`/works/${work.id}?ep=${ep}`);
  }

  const current = episodes[ep - 1];
  const prev = ep > 1 ? episodes[ep - 2] : undefined;
  const next = ep < episodes.length ? episodes[ep] : undefined;
  // 被他人买断：不展示正文试读
  const markdown = buyoutTaken && !canRead ? "" : canRead ? current.body : previewMarkdown(current.body);
  const discussions =
    work.status === "published" ? listDiscussionsByWork(work.id, 40) : [];
  const discussionCount = work.status === "published" ? countDiscussionsByWork(work.id) : 0;

  return (
    <div className="wrap page">
      <div className="work-layout">
        <header className="work-head">
          <img className="work-cover" src={coverSrc(work.id)} alt="" />
          <div>
            <p className="kicker">
              {kindLabel(work.kind)} · {categoryName(work.category)}
              {episodes.length > 1 ? ` · 共 ${episodes.length} 集` : ""}
            </p>
            <h1>{work.title}</h1>
            <div className="meta">
              <span>{work.author}</span>
              <span>{work.word_count} 字</span>
              <span>{formatReads((work.read_count || 0) + (work.status === "published" ? 1 : 0))}</span>
              {!showBuy ? <span>{priceText}</span> : null}
              <span>{formatDate(work.created_at)}</span>
              {iOwnBuyout ? <span>已买断</span> : unlocked && !buyoutTaken ? <span>已购买</span> : null}
              {buyoutTaken && !iOwnBuyout && !isAuthor ? <span>已被买断</span> : null}
            </div>
            <p className="intro" style={{ marginTop: 10 }}>
              {work.summary}
            </p>
            {query.cover === "ok" && isAdmin ? (
              <p className="note">封面已替换。若仍看到旧图，请再刷新一次。</p>
            ) : null}
            {showBuy ? (
              <WorkPurchase
                workId={work.id}
                coins={unlockCoins}
                balance={user?.coins ?? 0}
                loggedIn={Boolean(user)}
                unlocked={unlocked && !buyoutTaken}
                buyout={iOwnBuyout}
                takenByOther={buyoutTaken && !iOwnBuyout}
              />
            ) : canDownload ? (
              <p className="work-actions">
                <a className="btn solid" href={`/api/works/${work.id}/download`} download>
                  {work.kind === "novel" ? "下载完整小说" : "下载完整剧本"}
                </a>
              </p>
            ) : null}
            {work.status !== "published" && isAuthor ? (
              <div className="reject-box" role="status">
                <p className="banner" style={{ margin: 0 }}>
                  {work.status === "pending"
                    ? "这篇已入库待审，尚未上架，只有你自己看得到。"
                    : "这篇没有通过审核，只有你自己看得到。"}
                </p>
                {work.status !== "pending" && review ? (
                  <p className="hint" style={{ margin: "8px 0 0" }}>
                    综合 {review.score.toFixed(1)} 分 · {review.grade}
                    {review.advice[0] ? ` · ${review.advice[0]}` : ""}
                  </p>
                ) : null}
                <p className="hint" style={{ margin: "8px 0 0" }}>
                  {work.status === "pending" ? (
                    <>
                      可以继续到<a href="/upload">投稿页</a>上传下一部；不需要了可删除。
                    </>
                  ) : (
                    <>
                      请按下方审核意见改稿后，到<a href="/upload">投稿页</a>重新上传一版；不需要了可直接删除。
                    </>
                  )}
                </p>
                <DeleteRejectedWorkForm workId={work.id} />
              </div>
            ) : null}
            {buyoutTaken && !iOwnBuyout && !isAuthor ? (
              <p className="banner">这篇已被买断，仅买断者可阅读，其他人无法再查看正文。</p>
            ) : null}
          </div>
        </header>
        {review && work.status !== "pending" && (canRead || !buyoutTaken || isAdmin) ? (
          <ReviewCard review={review} rejected={work.status === "rejected"} />
        ) : null}
        {isAdmin ? (
          <AdminWorkPanel
            workId={work.id}
            title={work.title}
            score={work.score}
            status={work.status}
            price={work.price}
            kind={work.kind}
            summary={review?.summary || work.summary}
            aiCoverReady={hasAiCoverConfig()}
          />
        ) : null}
        <div className="work-main">
          {buyoutTaken && !canRead ? (
            <p className="empty">正文已对其他读者关闭。</p>
          ) : (
            <>
              {episodes.length > 1 ? (
                <p className="episode-label">
                  第 {ep} 集 · {current.title}
                  {!canRead ? <span className="hint">（试读）</span> : null}
                </p>
              ) : null}
              <NoCopy enabled={canRead && work.price > 0 && !isAuthor}>
                <Reader markdown={markdown} cut={!canRead} />
              </NoCopy>
              {canRead ? (
                <EpisodeNav
                  workId={work.id}
                  current={ep}
                  total={episodes.length}
                  title={current.title}
                  prevTitle={prev?.title}
                  nextTitle={next?.title}
                />
              ) : episodes.length > 1 && !buyoutTaken ? (
                <p className="hint episode-lock-hint">
                  购买后可阅读全部 {episodes.length} 集，并用上一集 / 下一集翻页。
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>

      {work.status === "published" ? (
        <section className="discussion-section" id="discussion">
          <div className="section-title">
            <h2>读者讨论{discussionCount > 0 ? ` · ${discussionCount}` : ""}</h2>
            <a href={`/community?workId=${work.id}`}>引用到社区</a>
          </div>
          {user ? (
            <WorkDiscussionForm workId={work.id} />
          ) : (
            <p className="empty">
              <a href={`/login?next=${encodeURIComponent(`/works/${work.id}#discussion`)}`}>登录</a>
              后参与讨论。
            </p>
          )}
          <DiscussionList
            items={discussions}
            currentUserId={user?.id}
            next={`/works/${work.id}#discussion`}
          />
        </section>
      ) : null}
    </div>
  );
}
