import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PayResultClient } from "@/components/PayResultClient";
import { getCurrentUser } from "@/lib/auth";
import { findPayOrderByAny } from "@/lib/db";
import { payOrigin } from "@/lib/origin";
import { fulfillPayOrder } from "@/lib/pay-fulfill";
import { payConfigured, queryUpstreamPayment } from "@/lib/pay";

export const metadata: Metadata = { title: "支付结果" };
export const dynamic = "force-dynamic";

async function tryFulfillQuick(orderNo: string) {
  if (!payConfigured()) return false;
  try {
    const remote = await Promise.race([
      queryUpstreamPayment(orderNo),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 2500);
      }),
    ]);
    if (!remote) return false;
    if (String(remote.payStatus || "").toUpperCase() === "SUCCESS") {
      fulfillPayOrder(orderNo, remote.serialOrderNo);
      return true;
    }
  } catch {
    /* client will poll */
  }
  return false;
}

/**
 * 支付同步回跳。服务端先快速查一次单；未成功再交给客户端轮询。
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

  if (!orderNo) redirect("/wallet");

  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="wrap page">
        <p className="kicker">支付回跳</p>
        <h1>请先登录</h1>
        <p className="intro">支付可能已完成，登录后可在钱包确认到账。</p>
        <p className="stack" style={{ marginTop: 16 }}>
          <a className="btn solid" href={`/login?next=${encodeURIComponent(`/pay/r/${orderNo}`)}`}>
            去登录
          </a>
          <a className="btn ghost" href="/wallet">
            打开钱包
          </a>
        </p>
      </div>
    );
  }

  const local = findPayOrderByAny(orderNo);
  if (!local || local.user_id !== user.id) {
    return (
      <div className="wrap page">
        <p className="kicker">支付回跳</p>
        <h1>找不到订单</h1>
        <p className="intro">请打开钱包查看余额是否已到账。</p>
        <p style={{ marginTop: 16 }}>
          <a className="btn solid" href="/wallet">
            返回钱包
          </a>
        </p>
      </div>
    );
  }

  if (local.status === "SUCCESS") {
    redirect("/wallet?ok=1");
  }

  const mchOrderNo = local.mch_order_no;
  const paid = await tryFulfillQuick(mchOrderNo);
  if (paid) {
    redirect("/wallet?ok=1");
  }

  return <PayResultClient orderNo={mchOrderNo} loginUrl={loginUrl} />;
}
