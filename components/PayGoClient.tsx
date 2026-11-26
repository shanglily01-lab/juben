"use client";

import { useEffect, useState } from "react";

/** 站内中转：先停在本域，再跳上游；回跳与钱包一律用绝对地址，防止丢域。 */
export function PayGoClient({
  orderNo,
  payUrl,
  returnHref,
  walletHref,
}: {
  orderNo: string;
  payUrl: string;
  returnHref: string;
  walletHref: string;
}) {
  const [left, setLeft] = useState(false);
  const leftKey = `payLeft:${orderNo}`;

  useEffect(() => {
    if (!payUrl) return;

    // 从支付页「返回」再次落到本页时，不要重新打开支付，直接去结果页
    try {
      if (sessionStorage.getItem(leftKey) === "1") {
        window.location.replace(returnHref);
        return;
      }
      sessionStorage.setItem("pendingTopup", orderNo);
    } catch {
      /* ignore */
    }

    const timer = window.setTimeout(() => {
      try {
        sessionStorage.setItem(leftKey, "1");
      } catch {
        /* ignore */
      }
      setLeft(true);
      window.location.assign(payUrl);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [orderNo, payUrl, returnHref, leftKey]);

  return (
    <div className="wrap page">
      <p className="kicker">支付</p>
      <h1>{left ? "请在支付页完成付款" : "正在打开支付…"}</h1>
      <p className="intro">
        {left
          ? "付完后应自动回到大黄书。若停在空白页，点下面「查看支付结果」回站。"
          : "马上跳转到微信 / 支付宝，请勿关闭本站。"}
      </p>
      <div className="stack" style={{ marginTop: 18 }}>
        <a className="btn solid" href={returnHref}>
          查看支付结果
        </a>
        {payUrl ? (
          <a className="btn ghost" href={payUrl}>
            重新打开支付页
          </a>
        ) : null}
        <a className="btn ghost" href={walletHref}>
          返回钱包
        </a>
      </div>
    </div>
  );
}
