"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function PayReturnClient() {
  const params = useSearchParams();
  const router = useRouter();
  const orderNo = params.get("orderNo") || "";
  const topup = params.get("topup") || "";
  const [text, setText] = useState("正在确认支付结果…");

  useEffect(() => {
    if (!orderNo) {
      setText("缺少订单号");
      return;
    }
    let stopped = false;
    let tries = 0;
    const tick = async () => {
      tries += 1;
      try {
        const response = await fetch(`/api/pay/query?orderNo=${encodeURIComponent(orderNo)}`);
        const data = (await response.json()) as {
          ok?: boolean;
          order?: { payStatus?: string; kind?: string };
        };
        const status = data.order?.payStatus || "";
        if (status === "SUCCESS") {
          setText("充值成功，正在跳转…");
          router.replace("/wallet?ok=1");
          return;
        }
        if (["FAIL", "TIMEOUT", "EXCEPTION", "CLOSE"].includes(status)) {
          setText("支付未完成，可返回钱包重试。");
          return;
        }
      } catch {
        /* keep polling */
      }
      if (!stopped && tries < 40) setTimeout(tick, 1500);
      else if (!stopped) setText("仍在等待支付结果，可稍后刷新钱包。");
    };
    tick();
    return () => {
      stopped = true;
    };
  }, [orderNo, topup, router]);

  return (
    <div className="wrap page">
      <p className="kicker">支付回跳</p>
      <h1>支付结果</h1>
      <p className="intro">{text}</p>
      <p className="hint">
        <a href="/wallet">返回钱包</a>
      </p>
    </div>
  );
}
