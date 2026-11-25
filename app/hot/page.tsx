import type { Metadata } from "next";

import { HotRank } from "@/components/HotRank";
import { listHotPurchaseWorks, listHotWorks, listRecommendRankWorks } from "@/lib/db";

export const metadata: Metadata = { title: "榜单" };

const TABS = [
  { id: "hot", label: "热度", hint: "按阅读次数" },
  { id: "buy", label: "热购", hint: "按购买 / 买断" },
  { id: "rec", label: "推荐", hint: "按评分，兼顾热度" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function resolveTab(raw: string | undefined): TabId {
  if (raw === "buy" || raw === "rec" || raw === "hot") return raw;
  return "hot";
}

export default async function HotPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab = resolveTab(params.tab);
  const works =
    tab === "buy" ? listHotPurchaseWorks(30) : tab === "rec" ? listRecommendRankWorks(30) : listHotWorks(30);
  const metric = tab === "buy" ? "purchases" : tab === "rec" ? "recommend" : "reads";
  const current = TABS.find((item) => item.id === tab) ?? TABS[0];

  return (
    <div className="wrap page">
      <p className="kicker">发现</p>
      <h1>榜单</h1>
      <p className="intro">{current.hint}。</p>

      <nav className="rank-tabs" aria-label="榜单分类">
        {TABS.map((item) => (
          <a
            key={item.id}
            href={`/hot?tab=${item.id}`}
            className={tab === item.id ? "on" : undefined}
            aria-current={tab === item.id ? "page" : undefined}
          >
            {item.label}
          </a>
        ))}
      </nav>

      {works.length === 0 ? (
        <p className="empty">暂无数据</p>
      ) : (
        <HotRank works={works} metric={metric} />
      )}
    </div>
  );
}
