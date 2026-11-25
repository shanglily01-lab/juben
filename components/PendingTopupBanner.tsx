"use client";

import { useEffect, useState } from "react";

/** 从支付页返回钱包时，若还有未确认订单，提示去查结果。 */
export function PendingTopupBanner() {
  const [orderNo, setOrderNo] = useState("");

  useEffect(() => {
    try {
      const pending = sessionStorage.getItem("pendingTopup") || "";
      if (pending) setOrderNo(pending);
    } catch {
      /* ignore */
    }
  }, []);

  if (!orderNo) return null;

  return (
    <p className="note">
      有一笔充值待确认。
      <a href={`/pay/return?orderNo=${encodeURIComponent(orderNo)}`}>查看支付结果</a>
      {" · "}
      <button
        type="button"
        className="linkish"
        onClick={() => {
          try {
            sessionStorage.removeItem("pendingTopup");
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
