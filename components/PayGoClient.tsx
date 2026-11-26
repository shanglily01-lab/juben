"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 上游收银台（如 143.x:9557/store/pay）付完经常不回跳。
 * 因此本页绝不自动 location 跳走：在本站等待 + 新窗口打开支付 + 轮询到账。
 */
export function PayGoClient({
  orderNo,
  payUrl,
  walletHref,
}: {
  orderNo: string;
  payUrl: string;
  returnHref?: string;
  walletHref: string;
}) {
  const [statusText, setStatusText] = useState("等待打开支付…");
  const [paid, setPaid] = useState(false);
  const [opened, setOpened] = useState(false);
  const triesRef = useRef(0);

  useEffect(() => {
    if (!orderNo) return;
    try {
      sessionStorage.setItem("pendingTopup", orderNo);
      sessionStorage.setItem(`payLeft:${orderNo}`, "1");
      // 下单页若已 window.open，这里标记已打开
      if (sessionStorage.getItem(`payUrl:${orderNo}`)) setOpened(true);
    } catch {
      /* ignore */
    }

    let stopped = false;
    let timer = 0;

    const clearPending = () => {
      try {
        sessionStorage.removeItem("pendingTopup");
        sessionStorage.removeItem(`payLeft:${orderNo}`);
      } catch {
        /* ignore */
      }
    };

    const poll = async () => {
      if (stopped) return;
      triesRef.current += 1;
      try {
        const response = await fetch(`/api/pay/query?orderNo=${encodeURIComponent(orderNo)}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (response.status === 401) {
          setStatusText("登录已失效，请重新登录");
          return;
        }
        const data = (await response.json()) as { order?: { payStatus?: string } };
        const status = String(data.order?.payStatus || "").toUpperCase();
        if (status === "SUCCESS") {
          setPaid(true);
          setStatusText("充值成功，正在返回钱包…");
          clearPending();
          window.location.replace("/wallet?ok=1");
          return;
        }
        if (["FAIL", "TIMEOUT", "EXCEPTION", "CLOSE"].includes(status)) {
          setStatusText("支付未完成，可重新打开支付或返回钱包换档位。");
          return;
        }
        setStatusText(
          opened
            ? `等待支付结果中…（已查询 ${triesRef.current} 次，付完请回到本页）`
            : "请先点下方按钮打开支付页",
        );
      } catch {
        setStatusText("查单暂时失败，稍后自动重试…");
      }
      if (!stopped) timer = window.setTimeout(poll, 1500);
    };

    void poll();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [orderNo, opened]);

  const openPay = () => {
    if (!payUrl) return;
    setOpened(true);
    setStatusText("已打开支付页。请在支付页完成付款，然后回到本页，勿停在支付平台。");
    // 新窗口：本页继续轮询。被拦截时退回同页打开。
    const win = window.open(payUrl, "_blank", "noopener,noreferrer");
    if (!win) {
      window.location.href = payUrl;
    }
  };

  const checkNow = async () => {
    setStatusText("正在确认支付结果…");
    try {
      const response = await fetch(`/api/pay/query?orderNo=${encodeURIComponent(orderNo)}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = (await response.json()) as { order?: { payStatus?: string } };
      const status = String(data.order?.payStatus || "").toUpperCase();
      if (status === "SUCCESS") {
        setPaid(true);
        setStatusText("充值成功，正在返回钱包…");
        try {
          sessionStorage.removeItem("pendingTopup");
          sessionStorage.removeItem(`payLeft:${orderNo}`);
        } catch {
          /* ignore */
        }
        window.location.replace("/wallet?ok=1");
        return;
      }
      setStatusText("尚未到账。若已付款，请稍等几秒再点「我已完成支付」。");
    } catch {
      setStatusText("确认失败，请稍后重试。");
    }
  };

  return (
    <div className="wrap page">
      <p className="kicker">支付</p>
      <h1>{paid ? "充值成功" : "请在支付页完成付款"}</h1>
      <p className="intro">{statusText}</p>
      <p className="hint" style={{ marginTop: 8 }}>
        说明：第三方支付页（收银台）付完后通常不会自动跳回。请付完后回到本页，点「我已完成支付」。
      </p>
      <div className="stack" style={{ marginTop: 18 }}>
        <button className="btn solid" type="button" onClick={openPay}>
          {opened ? "重新打开支付页" : "打开支付页"}
        </button>
        <button className="btn solid" type="button" onClick={() => void checkNow()}>
          我已完成支付
        </button>
        <a className="btn ghost" href={`/pay/r/${encodeURIComponent(orderNo)}`}>
          查看支付结果
        </a>
        <a className="btn ghost" href={walletHref.startsWith("http") ? "/wallet" : walletHref}>
          返回钱包
        </a>
      </div>
    </div>
  );
}
