import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "支付" };

/** 上游若只回跳到 /pay（丢掉子路径），落到钱包/回跳页，而不是书库默认页。 */
export default async function PayPage({
  searchParams,
}: {
  searchParams: Promise<{ orderNo?: string; mchOrderNo?: string; o?: string }>;
}) {
  const params = await searchParams;
  const orderNo = (params.orderNo || params.mchOrderNo || params.o || "").trim();
  if (orderNo) {
    redirect(`/pay/r/${encodeURIComponent(orderNo)}`);
  }
  redirect("/wallet");
}
