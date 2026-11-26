import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PayGoClient } from "@/components/PayGoClient";
import { getCurrentUser } from "@/lib/auth";
import { findPayOrder } from "@/lib/db";
import { payOrigin } from "@/lib/origin";

export const metadata: Metadata = { title: "去支付" };

export default async function PayGoPage({
  searchParams,
}: {
  searchParams: Promise<{ orderNo?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const orderNo = (params.orderNo || "").trim();
  if (!user) redirect(`/login?next=${encodeURIComponent(orderNo ? `/pay/go?orderNo=${orderNo}` : "/wallet")}`);
  if (!orderNo) redirect("/wallet");

  const order = findPayOrder(orderNo);
  if (!order || order.user_id !== user.id) redirect("/wallet");
  if (order.status === "SUCCESS") redirect("/wallet?ok=1");

  const payUrl = order.pay_url || "";
  if (!payUrl) redirect("/wallet");

  const site = await payOrigin();
  const returnHref = `${site}/pay/r/${encodeURIComponent(orderNo)}`;
  const walletHref = `${site}/wallet`;

  return <PayGoClient orderNo={orderNo} payUrl={payUrl} returnHref={returnHref} walletHref={walletHref} />;
}
