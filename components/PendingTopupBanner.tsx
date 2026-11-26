"use client";

import { useEffect, useState } from "react";

/** 钱包页：有待确认充值时轮询，到账后自动刷新。 */
export function PendingTopupBanner() {
  const [orderNo, setOrderNo] = useState("");
  const [text, setText] = useState("有一笔充值待确认。");

  useEffect(() => {
    let pending = "";
    try {
      pending = sessionStorage.getItem("pendingTopup") || "";
    } catch {
      /* ignore */
    }
    if (!pending) return;
    setOrderNo(pending);

    let stopped = false;
    let tries = 0;
    let timer = 0;

    const tick = async () => {
      if (stopped) return;
      tries += 1;
      try {
        const response = await fetch(`/api/pay/query?orderNo=${encodeURIComponent(pending)}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (response.status === 401) return;
        const data = (await response.json()) as { order?: { payStatus?: string } };
        const status = String(data.order?.payStatus || "").toUpperCase();
        if (status === "SUCCESS") {
          setText("充值已到账，正在刷新…");
          try {
            sessionStorage.removeItem("pendingTopup");
            sessionStorage.removeItem(`payLeft:${pending}`);
          } catch {
            /* ignore */
          }
          window.location.replace("/wallet?ok=1");
          return;
        }
        setText(`有一笔充值待确认（已检查 ${tries} 次）。`);
      } catch {
        /* keep */
      }
      if (!stopped && tries < 40) timer = window.setTimeout(tick, 2000);
    };

    void tick();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, []);

  if (!orderNo) return null;

  return (
    <p className="note">
      {text}{" "}
      <a href={`/pay/r/${encodeURIComponent(orderNo)}`}>查看结果</a>
      {" · "}
      <a href={`/pay/go?orderNo=${encodeURIComponent(orderNo)}`}>回支付页</a>
      {" · "}
      <button
        type="button"
        className="linkish"
        onClick={() => {
          try {
            sessionStorage.removeItem("pendingTopup");
            sessionStorage.removeItem(`payLeft:${orderNo}`);
          } catch {
            /* ignore */
          }
          setOrderNo("");
        }}
      >
        忽略
      </button>
    </p>
  );
}
