import {
  findPayOrder,
  getWorkDetail,
  grantUnlockPaid,
  grantWorkBuyout,
  markPayOrderPaid,
  markRequirementPaid,
} from "@/lib/db";

/** Apply entitlements after a successful payment (notify or query). Idempotent. */
export function fulfillPayOrder(mchOrderNo: string, serialOrderNo?: string) {
  const marked = markPayOrderPaid(mchOrderNo, serialOrderNo);
  if (!marked.ok) return marked;
  const order = findPayOrder(mchOrderNo);
  if (!order) return { ok: false as const, error: "订单不存在" };

  if (order.kind === "requirement") {
    if (!order.requirement_id) return { ok: false as const, error: "订单缺少征稿" };
    const paid = markRequirementPaid(order.requirement_id);
    if (!paid.ok) return { ok: false as const, error: paid.error };
    return {
      ok: true as const,
      kind: "requirement" as const,
      requirementId: order.requirement_id,
      already: marked.already || paid.already,
    };
  }

  if (!order.work_id) return { ok: false as const, error: "订单缺少作品" };
  const work = getWorkDetail(order.work_id);
  if (!work) return { ok: false as const, error: "作品不存在" };

  if (order.kind === "buyout") {
    const granted = grantWorkBuyout(order.user_id, work.id, work.title);
    if (!granted.ok) return { ok: false as const, error: granted.error };
    return { ok: true as const, kind: "buyout" as const, workId: work.id, already: marked.already || granted.already };
  }

  if (order.kind === "unlock") {
    grantUnlockPaid(order.user_id, work.id, work.title, Math.round(order.amount_fen / 100));
    return { ok: true as const, kind: "unlock" as const, workId: work.id, already: marked.already };
  }

  return { ok: false as const, error: "未知订单类型" };
}
