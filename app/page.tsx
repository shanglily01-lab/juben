import { HotRank } from "@/components/HotRank";
import { WorkCard } from "@/components/WorkCard";
import {
  featuredWork,
  listHotPurchaseWorks,
  listHotWorks,
  listRecommendRankWorks,
  listWorks,
} from "@/lib/db";
import { coverSrc } from "@/lib/cover";
import { formatReads, kindLabel, shelfPriceLabel, shelfSpec } from "@/lib/format";
import type { PublicWork } from "@/lib/types";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ activated?: string }> }) {
  const params = await searchParams;
  const featured = featuredWork();
  const hotReads = listHotWorks(6);
  const hotBuys = listHotPurchaseWorks(6);
  const recommendRank = listRecommendRankWorks(6);
  const scripts = listWorks({ kind: "script", limit: 6 })
    .filter((work) => work.id !== featured?.id)
    .slice(0, 4);
  const novels = listWorks({ kind: "novel", limit: 6 })
    .filter((work) => work.id !== featured?.id)
    .slice(0, 4);

  return (
    <div className="wrap page">
      {params.activated === "1" ? <p className="note">邮箱已激活，金币已入账。</p> : null}

      {featured ? (
        <>
          <div className="section-title">
            <h2>本期先读</h2>
            <a href={`/works/${featured.id}`}>打开</a>
          </div>
          <a className="feature" href={`/works/${featured.id}`}>
            <img className="feature-cover" src={coverSrc(featured.id)} alt="" />
            <div className="feature-copy">
              <span className="feature-label">本期</span>
              <div className="card-top">
                <span className={`badge ${featured.kind}`}>{kindLabel(featured.kind)}</span>
                <span className="badge">
                  {featured.buyoutTaken
                    ? "已买断"
                    : shelfPriceLabel(featured.price, featured.score, featured.episodeCount)}
                </span>
                <span className="badge light">{formatReads(featured.readCount)}</span>
              </div>
              <span className="stamp">{featured.grade}</span>
              <h2>{featured.title}</h2>
              <p>{featured.summary}</p>
              <p className="feature-spec">{shelfSpec(featured.kind, featured.wordCount)}</p>
            </div>
          </a>
        </>
      ) : (
        <p className="empty">书库还是空的。第一篇稿可以通过投稿放进来。</p>
      )}

      <div className="rank-boards home-ranks">
        <section className="rank-board">
          <div className="section-title">
            <h2>热度榜</h2>
            <a href="/hot?tab=hot">更多</a>
          </div>
          {hotReads.length === 0 ? <p className="empty">暂无</p> : <HotRank works={hotReads} metric="reads" />}
        </section>
        <section className="rank-board">
          <div className="section-title">
            <h2>热购榜</h2>
            <a href="/hot?tab=buy">更多</a>
          </div>
          {hotBuys.length === 0 ? (
            <p className="empty">暂无成交</p>
          ) : (
            <HotRank works={hotBuys} metric="purchases" />
          )}
        </section>
        <section className="rank-board">
          <div className="section-title">
            <h2>推荐榜</h2>
            <a href="/hot?tab=rec">更多</a>
          </div>
          {recommendRank.length === 0 ? (
            <p className="empty">暂无</p>
          ) : (
            <HotRank works={recommendRank} metric="recommend" />
          )}
        </section>
      </div>

      <Shelf title="推荐短剧" href="/browse?kind=script" works={scripts} />
      <Shelf title="推荐小说" href="/browse?kind=novel" works={novels} />
    </div>
  );
}

function Shelf({ title, href, works }: { title: string; href: string; works: PublicWork[] }) {
  if (works.length === 0) return null;
  return (
    <>
      <div className="section-title">
        <h2>{title}</h2>
        <a href={href}>更多</a>
      </div>
      <div className="cards cols">
        {works.map((work) => (
          <WorkCard key={work.id} work={work} />
        ))}
      </div>
    </>
  );
}
