import type { Metadata } from "next";

import { OpsRequirementActions } from "@/components/OpsRequirementActions";
import { categoryName } from "@/lib/categories";
import { listOpsRequirements } from "@/lib/db";
import { kindLabel } from "@/lib/format";
import { yuanLabel } from "@/lib/pricing";
import { requirementStatusLabel } from "@/lib/requirements";

export const metadata: Metadata = { title: "征稿交付" };

function adminOk(key: string | undefined) {
  const expected = process.env.ADMIN_SECRET?.trim();
  return Boolean(expected && key && key === expected);
}

export default async function OpsRequirementsPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; ok?: string }>;
}) {
  const params = await searchParams;
  const key = params.key || "";
  const allowed = adminOk(key);

  if (!allowed) {
    return (
      <div className="wrap page">
        <p className="kicker">站长</p>
        <h1>征稿交付</h1>
        <p className="intro">在地址后加 `?key=你的 ADMIN_SECRET` 进入。</p>
        <form className="form" method="get">
          <label>
            站长口令
            <input name="key" type="password" required autoComplete="off" />
          </label>
          <button className="btn" type="submit">
            进入
          </button>
        </form>
      </div>
    );
  }

  const items = listOpsRequirements();

  return (
    <div className="wrap page">
      <p className="kicker">站长</p>
      <h1>征稿交付</h1>
      <p className="intro">把已上架作品 ID 填进对应征稿，交付后会对需求方独占买断。</p>
      {params.ok === "1" ? <p className="note">已交付。</p> : null}

      {items.length === 0 ? (
        <p className="empty">暂无已付款征稿</p>
      ) : (
        <div className="req-list">
          {items.map((item) => (
            <article className="req-card" key={item.id}>
              <div className="req-card-top">
                <span className="badge">{kindLabel(item.kind)}</span>
                <span className="badge light">{categoryName(item.category)}</span>
                <span className={`pill${item.status === "delivered" ? " ok" : ""}`}>
                  {requirementStatusLabel(item.status)}
                </span>
              </div>
              <strong>
                #{item.id} {item.title}
              </strong>
              <p className="hint">
                {item.username} · 赏金 {yuanLabel(item.bounty_yuan)}
                {item.delivered_work_id ? ` · 作品 #${item.delivered_work_id}` : ""}
              </p>
              <p>{item.brief.slice(0, 200)}{item.brief.length > 200 ? "…" : ""}</p>
              {item.status === "delivered" ? (
                <p className="hint">
                  已交付 → <a href={`/works/${item.delivered_work_id}`}>打开作品</a>
                </p>
              ) : (
                <OpsRequirementActions requirementId={item.id} secret={key} status={item.status} />
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
