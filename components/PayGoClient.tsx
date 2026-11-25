"use client";

import { useEffect, useState } from "react";

/** 站内中转：先停在本域，再跳上游；关掉支付页时还能回到这里点「已完成」。 */
export function PayGoClient({
  orderNo,
  payUrl,
  returnHref,
}: {
  orderNo: string;
  payUrl: string;
  returnHref: string;
}) {
  const [left, setLeft] = useState(false);

  useEffect(() => {
    if (!payUrl) return;
    try {
      sessionStorage.setItem("pendingTopup", orderNo);
    } catch {
      /* ignore */
    }
    const timer = window.setTimeout(() => {
      setLeft(true);
      location.href = payUrl;
    }, 400);
    return () => window.clearTimeout(timer);
  }, [orderNo, payUrl]);

  return (
    <div className="wrap page">
      <p className="kicker">支付</p>
      <h1>{left ? "请在支付页完成付款" : "正在打开支付…"}</h1>
      <p className="intro">
        {left
          ? "付完后若没有自动回来，点下面按钮查看结果。不要关到浏览器空白页。"
          : "马上跳转到微信 / 支付宝，请勿关闭本站。"}
      </p>
      <div className="stack" style={{ marginTop: 18 }}>
        <a className="btn solid" href={returnHref}>
          我已完成支付
        </a>
        {payUrl ? (
          <a className="btn ghost" href={payUrl}>
            重新打开支付页
          </a>
        ) : null}
        <a className="btn ghost" href="/wallet">
          返回钱包
        </a>
      </div>
    </div>
  );
}
