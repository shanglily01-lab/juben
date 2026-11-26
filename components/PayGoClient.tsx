"use client";

import { useEffect, useState } from "react";

/**
 * 站内中转：跳上游支付。付完常见两种回法——
 * 1) 上游同步打开 returnUrl
 * 2) 微信/支付宝关掉后 bfcache 回到本页（useEffect 不重跑）
 * 所以必须用 pageshow/visibility + 轮询查单，不能只靠挂载时跳一次。
 */
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
  const [hint, setHint] = useState("马上跳转到微信 / 支付宝，请勿关闭本站。");
  const leftKey = `payLeft:${orderNo}`;

  useEffect(() => {
    if (!payUrl || !orderNo) return;

    let stopped = false;
    let pollTimer = 0;
    let launchTimer = 0;

    const markLeft = () => {
      try {
        sessionStorage.setItem(leftKey, "1");
        sessionStorage.setItem("pendingTopup", orderNo);
      } catch {
        /* ignore */
      }
      setLeft(true);
    };

    const alreadyLeft = () => {
      try {
        return sessionStorage.getItem(leftKey) === "1";
      } catch {
        return false;
      }
    };

    const goResult = () => {
      if (stopped) return;
      // 中转页已在本域，用相对路径进结果页最稳
      window.location.replace(`/pay/r/${encodeURIComponent(orderNo)}`);
    };

    const goWalletOk = () => {
      if (stopped) return;
      try {
        sessionStorage.removeItem("pendingTopup");
        sessionStorage.removeItem(leftKey);
      } catch {
        /* ignore */
      }
      window.location.replace("/wallet?ok=1");
    };

    const pollOnce = async () => {
      try {
        const response = await fetch(`/api/pay/query?orderNo=${encodeURIComponent(orderNo)}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (response.status === 401) return;
        const data = (await response.json()) as { order?: { payStatus?: string } };
        const status = String(data.order?.payStatus || "").toUpperCase();
        if (status === "SUCCESS") {
          setHint("充值成功，正在返回钱包…");
          goWalletOk();
          return true;
        }
      } catch {
        /* keep polling */
      }
      return false;
    };

    const startPolling = () => {
      const tick = async () => {
        if (stopped) return;
        const done = await pollOnce();
        if (!done && !stopped) pollTimer = window.setTimeout(tick, 1200);
      };
      void tick();
    };

    // 从支付页返回（含 bfcache）：立刻去结果页，同时本页也继续轮询
    const onBack = () => {
      if (!alreadyLeft()) return;
      if (document.visibilityState && document.visibilityState !== "visible") return;
      setHint("已从支付页返回，正在确认结果…");
      setLeft(true);
      void pollOnce().then((ok) => {
        if (!ok) goResult();
      });
    };

    window.addEventListener("pageshow", onBack);
    document.addEventListener("visibilitychange", onBack);

    if (alreadyLeft()) {
      // 再次打开中转页：不要重开支付，查单或去结果页
      setLeft(true);
      setHint("正在确认支付结果…");
      startPolling();
      void pollOnce().then((ok) => {
        if (!ok) goResult();
      });
    } else {
      try {
        sessionStorage.setItem("pendingTopup", orderNo);
      } catch {
        /* ignore */
      }
      launchTimer = window.setTimeout(() => {
        markLeft();
        setHint("付完后应自动回站。若停在支付页，请点「完成」或返回；也可点下方查看结果。");
        startPolling();
        window.location.assign(payUrl);
      }, 350);
    }

    return () => {
      stopped = true;
      window.clearTimeout(launchTimer);
      window.clearTimeout(pollTimer);
      window.removeEventListener("pageshow", onBack);
      document.removeEventListener("visibilitychange", onBack);
    };
  }, [orderNo, payUrl, returnHref, leftKey]);

  return (
    <div className="wrap page">
      <p className="kicker">支付</p>
      <h1>{left ? "请完成付款" : "正在打开支付…"}</h1>
      <p className="intro">{hint}</p>
      <div className="stack" style={{ marginTop: 18 }}>
        <a className="btn solid" href={`/pay/r/${encodeURIComponent(orderNo)}`}>
          查看支付结果
        </a>
        {payUrl ? (
          <a className="btn ghost" href={payUrl}>
            重新打开支付页
          </a>
        ) : null}
        <a className="btn ghost" href={walletHref.startsWith("http") ? walletHref : "/wallet"}>
          返回钱包
        </a>
      </div>
    </div>
  );
}
