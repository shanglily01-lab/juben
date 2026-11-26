import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { findPayOrder } from "@/lib/db";
import { payOrigin } from "@/lib/origin";
import { fulfillPayOrder } from "@/lib/pay-fulfill";
import { payConfigured, queryUpstreamPayment } from "@/lib/pay";

export const metadata: Metadata = { title: "支付结果" };
export const dynamic = "force-dynamic";

/**
 * 支付同步回跳（无查询串）。服务端渲染 + 绝对链接，避免微信/支付宝 WebView 丢域或白屏。
 */
export default async function PayResultPathPage({
  params,
}: {
  params: Promise<{ orderNo: string }>;
}) {
  const { orderNo: raw } = await params;
  const orderNo = decodeURIComponent(raw || "").trim();
  const origin = await payOrigin();
  const walletUrl = `${origin}/wallet?ok=1`;
  const walletRetry = `${origin}/wallet`;
  const loginUrl = `${origin}/login?next=${encodeURIComponent(`/pay/r/${orderNo}`)}`;

  if (!orderNo) {
    redirect(walletRetry);
  }

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
          <a className="btn ghost" href={walletRetry}>
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
          <a className="btn solid" href={walletRetry}>
            返回钱包
          </a>
        </p>
      </div>
    );
  }

  let status = local.status;
  if (status !== "SUCCESS" && payConfigured()) {
    try {
      const remote = await queryUpstreamPayment(orderNo);
      if (remote.payStatus === "SUCCESS") {
        fulfillPayOrder(orderNo, remote.serialOrderNo);
        status = "SUCCESS";
      } else if (remote.payStatus) {
        status = remote.payStatus;
      }
    } catch {
      /* keep local */
    }
  }

  if (status === "SUCCESS") {
    return (
      <div className="wrap page">
        <p className="kicker">支付回跳</p>
        <h1>充值成功</h1>
        <p className="intro">金币已到账。若页面未自动跳转，请点下面按钮回站。</p>
        <p style={{ marginTop: 16 }}>
          <a className="btn solid" href={walletUrl}>
            返回钱包
          </a>
        </p>
        <meta httpEquiv="refresh" content={`2;url=${walletUrl}`} />
        <script
          dangerouslySetInnerHTML={{
            __html: `setTimeout(function(){location.replace(${JSON.stringify(walletUrl)});},800);`,
          }}
        />
      </div>
    );
  }

  if (["FAIL", "TIMEOUT", "EXCEPTION", "CLOSE"].includes(status)) {
    return (
      <div className="wrap page">
        <p className="kicker">支付回跳</p>
        <h1>支付未完成</h1>
        <p className="intro">可以返回钱包重新选择档位支付。</p>
        <p style={{ marginTop: 16 }}>
          <a className="btn solid" href={walletRetry}>
            返回钱包
          </a>
        </p>
      </div>
    );
  }

  // 仍在处理：给绝对链接 + 自动刷新本页
  const selfUrl = `${origin}/pay/r/${encodeURIComponent(orderNo)}`;
  return (
    <div className="wrap page">
      <p className="kicker">支付回跳</p>
      <h1>正在确认支付结果…</h1>
      <p className="intro">请稍候。若长时间无结果，可打开钱包查看是否已到账。</p>
      <p className="stack" style={{ marginTop: 16 }}>
        <a className="btn solid" href={selfUrl}>
          刷新结果
        </a>
        <a className="btn ghost" href={walletRetry}>
          打开钱包
        </a>
      </p>
      <meta httpEquiv="refresh" content={`3;url=${selfUrl}`} />
    </div>
  );
}
