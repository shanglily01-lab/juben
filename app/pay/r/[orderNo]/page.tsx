import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PayResultClient } from "@/components/PayResultClient";
import { getCurrentUser } from "@/lib/auth";
import { findPayOrder } from "@/lib/db";
import { payOrigin } from "@/lib/origin";

export const metadata: Metadata = { title: "支付结果" };
export const dynamic = "force-dynamic";

/**
 * 支付同步回跳（无查询串）。
 * 只做登录/订单校验，查单与跳转交给客户端轮询，避免服务端卡死、meta/script 不生效。
 */
export default async function PayResultPathPage({
  params,
}: {
  params: Promise<{ orderNo: string }>;
}) {
  const { orderNo: raw } = await params;
  const orderNo = decodeURIComponent(raw || "").trim();
  const origin = await payOrigin();
  const walletOkUrl = `${origin}/wallet?ok=1`;
  const walletUrl = `${origin}/wallet`;
  const loginUrl = `${origin}/login?next=${encodeURIComponent(`/pay/r/${orderNo}`)}`;

  if (!orderNo) redirect(walletUrl);

  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="wrap page">
        <p className="kicker">支付回跳</p>
        <h1>请先登录</h1>
        <p className="intro">支付可能已完成，登录后可在钱包确认到账。</p>
        <p className="stack" style={{ marginTop: 16 }}>
          <a className="btn solid" href={loginUrl}>
            去登录
          </a>
          <a className="btn ghost" href={walletUrl}>
            打开钱包
          </a>
        </p>
      </div>
    );
  }

  const local = findPayOrder(orderNo);
  if (!local || local.user_id !== user.id) {
    return (
      <div className="wrap page">
        <p className="kicker">支付回跳</p>
        <h1>找不到订单</h1>
        <p className="intro">请打开钱包查看余额是否已到账。</p>
        <p style={{ marginTop: 16 }}>
          <a className="btn solid" href={walletUrl}>
            返回钱包
          </a>
        </p>
      </div>
    );
  }

  // 已成功则直接进钱包，少一页卡顿
  if (local.status === "SUCCESS") {
    redirect("/wallet?ok=1");
  }

  return (
    <PayResultClient
      orderNo={orderNo}
      walletOkUrl={walletOkUrl}
      walletUrl={walletUrl}
      loginUrl={loginUrl}
    />
  );
}
