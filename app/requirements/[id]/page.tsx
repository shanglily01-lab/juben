import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RequirementPay } from "@/components/RequirementPay";
import { getCurrentUser } from "@/lib/auth";
import { categoryName } from "@/lib/categories";
import { getRequirement } from "@/lib/db";
import { formatDate, kindLabel } from "@/lib/format";
import { coinLabel } from "@/lib/pricing";
import { isPaidRequirementStatus, requirementStatusLabel } from "@/lib/requirements";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const item = getRequirement(Number(id));
  if (!item) return { title: "未找到" };
  return { title: item.title };
}

export default async function RequirementDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pay?: string }>;
}) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const item = getRequirement(id);
  if (!item) notFound();

  const user = await getCurrentUser();
  const isOwner = user?.id === item.user_id;
  const paid = isPaidRequirementStatus(item.status);
  if (!paid && !isOwner) notFound();

  const query = await searchParams;
  const showPay = item.status === "awaiting_pay" && isOwner;

  return (
    <div className="wrap page">
      <p className="kicker">
        {kindLabel(item.kind)} · {categoryName(item.category)}
      </p>
      <div className="section-title">
        <h1>{item.title}</h1>
        <span className={`pill${item.status === "delivered" ? " ok" : ""}`}>
          {requirementStatusLabel(item.status)}
        </span>
      </div>
      <p className="hint">
        {item.username} · {formatDate(item.created_at)}
        {item.paid_at ? ` · 已付 ${formatDate(item.paid_at)}` : ""}
      </p>

      <div className="panel">
        <span className="hint">赏金</span>
        <p className="balance">
          {coinLabel(item.bounty_yuan)}
          <small>{paid ? "已支付" : "待支付"}</small>
        </p>
      </div>

      {showPay ? (
        <>
          {query.pay === "1" ? <p className="note">征稿已创建，请用金币支付赏金后开始制作。</p> : null}
          <RequirementPay
            requirementId={item.id}
            title={item.title}
            coins={item.bounty_yuan}
            balance={user?.coins ?? 0}
            loggedIn={Boolean(user)}
            autoOpen={query.pay === "1"}
          />
        </>
      ) : null}

      <div className="section-title">
        <h2>内容要求</h2>
      </div>
      <div className="panel req-brief">
        <p>{item.brief}</p>
        {item.reference_text ? (
          <p className="hint">对标：{item.reference_text}</p>
        ) : null}
      </div>

      {item.status === "delivered" && item.delivered_work_id ? (
        <div className="panel">
          <span className="hint">已交付（仅需求方可读）</span>
          <p>
            {isOwner ? (
              <a className="btn" href={`/works/${item.delivered_work_id}`}>
                打开剧本
              </a>
            ) : (
              <span className="hint">该剧已独占交付给需求方</span>
            )}
          </p>
        </div>
      ) : paid ? (
        <p className="hint">已收到赏金，制作完成后会在此开放给你阅读。</p>
      ) : null}

      <p className="hint">
        <a href="/requirements">返回征稿大厅</a>
      </p>
    </div>
  );
}
