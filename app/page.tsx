import { CATEGORIES } from "@/lib/categories";
import { HotRank } from "@/components/HotRank";
import { WorkCard } from "@/components/WorkCard";
import {
  featuredWork,
  listHotPurchaseWorks,
  listHotWorks,
  listRecommendRankWorks,
  listWorks,
} from "@/lib/db";
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

  return (
    <div className="wrap page">
      {params.activated === "1" ? <p className="note">邮箱已激活，金币已入账。</p> : null}
      <section className="hero">
        <div className="hero-copy">
          <p className="kicker">大黄书剧本小说网</p>
          <h1>
            按类入匣，
            <br />
            读完再解锁。
          </h1>
          <p className="lede">
            悬疑、历史、灾难、穿越。大黄书收来的短剧剧本和注册用户的投稿放在一起，先自动审核评级，付费篇按集数与质量计价。
          </p>
          <div className="hero-actions">
            <a className="btn solid" href="/browse">
              浏览短剧
            </a>
            <a className="btn ghost" href="/hot">
              查看榜单
            </a>
          </div>
        </div>
        <div className="hero-mark" aria-hidden>
          <img className="hero-seal" src="/logo-mark.svg" width={78} height={78} alt="" />
          <span className="hero-vert">短剧剧本</span>
        </div>
      </section>

      <div className="cat-row" aria-label="分类">
        {CATEGORIES.map((item, index) => (
          <a className={`chip-block cat-${item.slug}`} key={item.slug} href={`/category/${item.slug}`}>
            <em>{String(index + 1).padStart(2, "0")}</em>
            <strong>{item.name}</strong>
            <span>{item.blurb}</span>
          </a>
        ))}
      </div>

      {featured ? (
        <>
          <div className="section-title">
            <h2>本期先读</h2>
            <a href={`/works/${featured.id}`}>打开</a>
          </div>
          <a className="feature" href={`/works/${featured.id}`}>
            <img className="feature-cover" src={`/covers/${featured.id}`} alt="" />
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

      <Shelf title="推荐短剧" href="/browse" works={scripts} />

      <div className="section-title">
        <h2>怎么用</h2>
      </div>
      <div className="steps">
        <article className="step">
          <b>01</b>
          注册并激活邮箱。每天签到、邀请好友也进同一份余额。
        </article>
        <article className="step">
          <b>02</b>
          上传 Markdown，或直接在页面里写。提交后自动审核、打分、决定上不上架。
        </article>
        <article className="step">
          <b>03</b>
          免费篇直接读。付费篇按集数与评分计价（¥20 起），也可单篇买断，买后可分集阅读、下载。
        </article>
      </div>
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
