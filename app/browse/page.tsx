import type { Metadata } from "next";

import { WorkCard } from "@/components/WorkCard";
import { CATEGORIES, categoryName, isCategory } from "@/lib/categories";
import { browseHref } from "@/lib/format";
import { listWorks } from "@/lib/db";

export const metadata: Metadata = { title: "书库" };

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; kind?: string }>;
}) {
  const params = await searchParams;
  const kind = params.kind === "script" || params.kind === "novel" ? params.kind : "";
  const category = params.category && isCategory(params.category) ? params.category : "";
  const q = (params.q ?? "").trim().slice(0, 40);
  const works = listWorks({ kind: kind || undefined, category, q, limit: 48 });

  let heading = "书库";
  if (kind === "script") heading = "短剧";
  if (kind === "novel") heading = "小说";
  if (category) heading = categoryName(category);
  if (q) heading = `「${q}」`;

  return (
    <div className="wrap page">
      <p className="kicker">书库</p>
      <h1>{heading}</h1>
      <form className="search" action="/browse">
        {kind ? <input type="hidden" name="kind" value={kind} /> : null}
        {category ? <input type="hidden" name="category" value={category} /> : null}
        <input name="q" defaultValue={q} placeholder="搜标题、简介、作者" aria-label="搜索" />
        <button className="btn solid" type="submit">
          搜索
        </button>
      </form>

      <nav className="cat-tabs" aria-label="体裁">
        <a className={!kind ? "on" : undefined} href={browseHref({ category, q })}>
          全部
        </a>
        <a
          className={kind === "script" ? "on" : undefined}
          href={browseHref({ kind: "script", category, q })}
        >
          短剧
        </a>
        <a
          className={kind === "novel" ? "on" : undefined}
          href={browseHref({ kind: "novel", category, q })}
        >
          小说
        </a>
      </nav>

      <nav className="cat-tabs" aria-label="分类">
        <a className={!category ? "on" : undefined} href={browseHref({ kind, q })}>
          全部分类
        </a>
        {CATEGORIES.map((item) => (
          <a
            key={item.slug}
            className={category === item.slug ? "on" : undefined}
            href={browseHref({ kind, category: item.slug, q })}
          >
            {item.name}
          </a>
        ))}
      </nav>

      {works.length === 0 ? (
        <p className="empty">
          这一格还是空的。<a href="/upload">去投稿</a>
        </p>
      ) : (
        <div className="cards cols">
          {works.map((work) => (
            <WorkCard key={work.id} work={work} />
          ))}
        </div>
      )}
    </div>
  );
}
