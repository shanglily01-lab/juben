import { CATEGORIES } from "@/lib/categories";
import { WorkCard } from "@/components/WorkCard";
import { featuredWork, listWorks } from "@/lib/db";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ activated?: string }> }) {
  const params = await searchParams;
  const featured = featuredWork();
  const latest = listWorks({ limit: 12 }).filter((work) => work.id !== featured?.id);

  return (
    <div className="wrap page">
      {params.activated === "1" ? <p className="note">邮箱已激活，金币已入账。</p> : null}
      <section className="hero">
        <div>
          <p className="kicker">短剧剧本 · 小说</p>
          <h1>按类入匣，读完再解锁。</h1>
          <p className="lede">
            悬疑、历史、灾难、穿越。编辑室的 Markdown 和注册用户的投稿放在一起，先自动审核评级，付费篇用同一套金币打开。
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
        <div className="hero-seal" aria-hidden>
          墨
        </div>
      </section>

      <div className="chips" aria-label="分类">
        {CATEGORIES.map((item) => (
          <a className="chip-block" key={item.slug} href={`/category/${item.slug}`}>
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
            <div className="card-top">
              <span className={`badge ${featured.kind}`}>{featured.kind === "script" ? "短剧" : "小说"}</span>
              <span className="badge">{featured.price <= 0 ? "免费" : `${featured.price} 金币`}</span>
            </div>
            <span className="stamp">{featured.grade}</span>
            <h2>{featured.title}</h2>
            <p>{featured.summary}</p>
          </a>
        </>
      ) : (
        <p className="empty">书库还是空的。第一篇稿可以通过投稿放进来。</p>
      )}

      <div className="section-title">
        <h2>新入匣</h2>
        <a href="/browse">全部</a>
      </div>
      <div className="cards cols">
        {latest.map((work) => (
          <WorkCard key={work.id} work={work} />
        ))}
      </div>

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
