import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/auth";
import { categoryName } from "@/lib/categories";
import { listPublicRequirements } from "@/lib/db";
import { kindLabel } from "@/lib/format";
import { yuanLabel } from "@/lib/pricing";
import { requirementStatusLabel } from "@/lib/requirements";

export const metadata: Metadata = { title: "征稿" };

export default async function RequirementsPage() {
  const user = await getCurrentUser();
  const items = listPublicRequirements(40);
  const newHref = user ? "/requirements/new" : "/login?next=/requirements/new";

  return (
    <div className="wrap page">
      <div className="section-title">
        <div>
          <p className="kicker">定制</p>
          <h1>征稿大厅</h1>
        </div>
        <a className="btn" href={newHref}>
          发布征稿
        </a>
      </div>
      <p className="intro">写下你要的剧，自填赏金（≥¥100）。付款后我们制作，交稿仅你可读。</p>

      {items.length === 0 ? (
        <p className="empty">
          还没有已付款的征稿。<a href={newHref}>第一条需求从这里发</a>
        </p>
      ) : (
        <div className="req-list">
          {items.map((item) => (
            <a className="req-card" key={item.id} href={`/requirements/${item.id}`}>
              <div className="req-card-top">
                <span className="badge">{kindLabel(item.kind)}</span>
                <span className="badge light">{categoryName(item.category)}</span>
                <span className={`pill${item.status === "delivered" ? " ok" : ""}`}>
                  {requirementStatusLabel(item.status)}
                </span>
              </div>
              <strong>{item.title}</strong>
              <p>{item.brief.slice(0, 120)}{item.brief.length > 120 ? "…" : ""}</p>
              <div className="req-card-foot">
                <span className="hint">{item.username}</span>
                <span className="req-bounty-inline">已付赏金 {yuanLabel(item.bounty_yuan)}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
