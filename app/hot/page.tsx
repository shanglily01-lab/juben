import type { Metadata } from "next";

import { HotRank } from "@/components/HotRank";
import { listHotPurchaseWorks, listHotWorks, listRecommendRankWorks } from "@/lib/db";

export const metadata: Metadata = { title: "榜单" };

export default function HotPage() {
  const hotReads = listHotWorks(20);
  const hotBuys = listHotPurchaseWorks(20);
  const recommend = listRecommendRankWorks(20);

  return (
    <div className="wrap page">
      <p className="kicker">发现</p>
      <h1>榜单</h1>
      <p className="intro">热度看阅读，热购看成交，推荐看评分。</p>

      <div className="rank-boards">
        <section className="rank-board">
          <div className="section-title">
            <h2>热度榜</h2>
          </div>
          <p className="hint">按阅读次数排序</p>
          {hotReads.length === 0 ? <p className="empty">暂无数据</p> : <HotRank works={hotReads} metric="reads" />}
        </section>

        <section className="rank-board">
          <div className="section-title">
            <h2>热购榜</h2>
          </div>
          <p className="hint">按购买 / 买断次数排序</p>
          {hotBuys.length === 0 ? (
            <p className="empty">暂无成交</p>
          ) : (
            <HotRank works={hotBuys} metric="purchases" />
          )}
        </section>

        <section className="rank-board">
          <div className="section-title">
            <h2>推荐榜</h2>
          </div>
          <p className="hint">按审核评分排序，兼顾阅读与购买</p>
          {recommend.length === 0 ? (
            <p className="empty">暂无推荐</p>
          ) : (
            <HotRank works={recommend} metric="recommend" />
          )}
        </section>
      </div>
    </div>
  );
}
