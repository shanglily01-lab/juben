import { CATEGORIES } from "@/lib/categories";
import { WorkCard } from "@/components/WorkCard";
import { featuredWork, listWorks } from "@/lib/db";
import { kindLabel, priceLabel, shelfSpec } from "@/lib/format";
import type { PublicWork } from "@/lib/types";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ activated?: string }> }) {
  const params = await searchParams;
  const featured = featuredWork();
  const scripts = listWorks({ kind: "script", limit: 6 })
    .filter((work) => work.id !== featured?.id)
    .slice(0, 4);
  const novels = listWorks({ kind: "novel", limit: 6 })
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
            悬疑、历史、灾难、穿越。大黄书收来的稿和注册用户的投稿放在一起，先自动审核评级，付费篇用同一套金币打开。
          </p>
          <div className="hero-actions">
            <a className="btn solid" href="/browse">
              进入书库
            </a>
            <a className="btn ghost" href="/upload">
              我要投稿
            </a>
          </div>
        </div>
        <div className="hero-mark" aria-hidden>
          <span className="hero-seal">书</span>
          <span className="hero-vert">剧本小说</span>
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
            <span className="feature-label">本期</span>
            <div className="card-top">
              <span className={`badge ${featured.kind}`}>{kindLabel(featured.kind)}</span>
              <span className="badge">{priceLabel(featured.price)}</span>
            </div>
            <span className="stamp">{featured.grade}</span>
            <h2>{featured.title}</h2>
            <p>{featured.summary}</p>
            <p className="feature-spec">{shelfSpec(featured.kind, featured.wordCount)}</p>
          </a>
        </>
      ) : (
        <p className="empty">书库还是空的。第一篇稿可以通过投稿放进来。</p>
      )}

      <Shelf title="推荐短剧" href="/browse?kind=script" works={scripts} />
      <Shelf title="推荐小说" href="/browse?kind=novel" works={novels} />

      <div className="section-title">
        <h2>怎么用</h2>
      </div>
      <div className="steps">
        <article className="step">
          <b>01</b>
          注册并激活邮箱后送 20 金币。每天签到、邀请好友也进同一份余额，短剧和小说都能用。
        </article>
        <article className="step">
          <b>02</b>
          上传 Markdown，或直接在页面里写。提交后自动审核、打分、决定上不上架。
        </article>
        <article className="step">
          <b>03</b>
          免费篇直接读。付费篇先看开头，金币够了再解锁全文。
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
