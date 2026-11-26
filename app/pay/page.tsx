import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { findPayOrderByAny } from "@/lib/db";

export const metadata: Metadata = { title: "支付" };

/**
 * 上游回跳兜底：可能带 orderNo / mchOrderNo / order_sn（上游 serial）。
 */
export default async function PayPage({
  searchParams,
}: {
  searchParams: Promise<{
    orderNo?: string;
    mchOrderNo?: string;
    o?: string;
    order_sn?: string;
    serialOrderNo?: string;
  }>;
}) {
  const params = await searchParams;
  const raw = (
    params.orderNo ||
    params.mchOrderNo ||
    params.o ||
    params.order_sn ||
    params.serialOrderNo ||
    ""
  ).trim();

  if (raw) {
    const order = findPayOrderByAny(raw);
    const orderNo = order?.mch_order_no || raw;
    redirect(`/pay/r/${encodeURIComponent(orderNo)}`);
  }
  redirect("/wallet");
}
