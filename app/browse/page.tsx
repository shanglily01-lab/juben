import type { Metadata } from "next";

import { WorkCard } from "@/components/WorkCard";
import { CATEGORIES, categoryName, isCategory } from "@/lib/categories";
import { browseHref } from "@/lib/format";
import { listWorks } from "@/lib/db";

export const metadata: Metadata = { title: "书库" };

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; category?: string; q?: string }>;
}) {
  const params = await searchParams;
  const kind = params.kind === "script" || params.kind === "novel" ? params.kind : "";
  const category = params.category && isCategory(params.category) ? params.category : "";
  const q = (params.q ?? "").trim().slice(0, 40);
  const works = listWorks({ kind, category, q, limit: 48 });

  let heading = "书库";
  if (kind === "script") heading = "短剧";
  if (kind === "novel") heading = "小说";
  if (category) heading = categoryName(category);
  if (q) heading = `「${q}」`;

  return (
    <div className="wrap page">
      <p className="kicker">大黄书剧本小说网</p>
      <h1>{heading}</h1>
      <form className="search" action="/browse">
        {kind ? <input type="hidden" name="kind" value={kind} /> : null}
        {category ? <input type="hidden" name="category" value={category} /> : null}
        <input name="q" defaultValue={q} placeholder="搜标题、简介、作者" aria-label="搜索" />
        <button className="btn solid" type="submit">
          搜索
        </button>
      </form>
      <div className="seg" aria-label="体裁">
        <a className={kind ? "" : "active"} href={browseHref({ category, q })}>
          全部
        </a>
        <a className={kind === "script" ? "active" : ""} href={browseHref({ kind: "script", category, q })}>
          短剧
        </a>
        <a className={kind === "novel" ? "active" : ""} href={browseHref({ kind: "novel", category, q })}>
          小说
        </a>
      </div>
      <div className="chips" aria-label="分类">
        <a className={category ? "chip" : "chip active"} href={browseHref({ kind, q })}>
          所有分类
        </a>
        {CATEGORIES.map((item) => (
          <a
            key={item.slug}
            className={category === item.slug ? "chip active" : "chip"}
            href={browseHref({ kind, category: item.slug, q })}
          >
            {item.name}
          </a>
        ))}
      </div>
      {works.length === 0 ? (
        <p className="empty">这一格还是空的。换个分类，或者把你的稿投进来。</p>
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
