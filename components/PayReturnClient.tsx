"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function PayReturnClient() {
  const params = useSearchParams();
  const router = useRouter();
  const orderNo = params.get("orderNo") || "";
  const workId = params.get("workId") || "";
  const requirementId = params.get("requirementId") || "";
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
          order?: {
            payStatus?: string;
            kind?: string;
            workId?: number | null;
            requirementId?: number | null;
          };
        };
        const status = data.order?.payStatus || "";
        if (status === "SUCCESS") {
          setText("支付成功，正在跳转…");
          let target = "/pay";
          if (data.order?.kind === "requirement") {
            const id = data.order.requirementId || requirementId;
            target = id ? `/requirements/${id}` : "/requirements";
          } else if (data.order?.kind === "unlock" || data.order?.kind === "buyout") {
            const id = data.order.workId || workId;
            target = id ? `/works/${id}` : "/mine";
          }
          router.replace(target);
          return;
        }
        if (["FAIL", "TIMEOUT", "EXCEPTION", "CLOSE"].includes(status)) {
          setText("支付未完成，可返回收银台重试。");
          return;
        }
      } catch {
        /* keep polling */
      }
      if (!stopped && tries < 40) setTimeout(tick, 1500);
      else if (!stopped) setText("仍在等待支付结果，可稍后刷新或返回收银台。");
    };
    tick();
    return () => {
      stopped = true;
    };
  }, [orderNo, workId, requirementId, router]);

  const backHref = requirementId
    ? `/requirements/${requirementId}`
    : workId
      ? `/works/${workId}`
      : "/pay";

  return (
    <div className="wrap page">
      <p className="kicker">支付回跳</p>
      <h1>支付结果</h1>
      <p className="intro">{text}</p>
      <p className="hint">
        <a href={backHref}>返回</a>
      </p>
    </div>
  );
}
