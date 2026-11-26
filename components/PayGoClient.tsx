"use client";

import { useEffect, useRef, useState } from "react";

function isMobilePayContext() {
  if (typeof window === "undefined") return true;
  const ua = navigator.userAgent || "";
  if (/MicroMessenger|AlipayClient|iPhone|iPad|Android|Mobile/i.test(ua)) return true;
  return window.matchMedia("(max-width: 880px), (hover: none)").matches;
}

/**
 * 上游收银台付完常不回跳。
 * 桌面：新窗口支付 + 本页轮询。
 * 手机：同页打开支付；返回本页后 pageshow/轮询自动确认。
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
  const [statusText, setStatusText] = useState("准备支付…");
  const [paid, setPaid] = useState(false);
  const [opened, setOpened] = useState(false);
  const [mobile, setMobile] = useState(true);
  const triesRef = useRef(0);

  useEffect(() => {
    setMobile(isMobilePayContext());
  }, []);

  useEffect(() => {
    if (!orderNo) return;
    try {
      sessionStorage.setItem("pendingTopup", orderNo);
      sessionStorage.setItem(`payLeft:${orderNo}`, "1");
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

    const goWalletOk = () => {
      clearPending();
      window.location.replace("/wallet?ok=1");
    };

    const pollOnce = async () => {
      triesRef.current += 1;
      try {
        const response = await fetch(`/api/pay/query?orderNo=${encodeURIComponent(orderNo)}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (response.status === 401) {
          setStatusText("登录已失效，请重新登录");
          return "auth";
        }
        const data = (await response.json()) as { order?: { payStatus?: string } };
        const status = String(data.order?.payStatus || "").toUpperCase();
        if (status === "SUCCESS") {
          setPaid(true);
          setStatusText("充值成功，正在返回钱包…");
          goWalletOk();
          return "ok";
        }
        if (["FAIL", "TIMEOUT", "EXCEPTION", "CLOSE"].includes(status)) {
          setStatusText("支付未完成，可重新打开支付或返回钱包。");
          return "fail";
        }
      } catch {
        /* keep */
      }
      return "wait";
    };

    const loop = async () => {
      if (stopped) return;
      const result = await pollOnce();
      if (result === "ok" || result === "fail" || result === "auth") return;
      setStatusText(
        opened
          ? `等待到账中…（第 ${triesRef.current} 次）付完请回到本页`
          : "点下方「打开支付」开始充值",
      );
      if (!stopped) timer = window.setTimeout(loop, 1500);
    };

    const onBack = () => {
      if (document.visibilityState === "hidden") return;
      setOpened(true);
      setStatusText("已从支付页返回，正在确认…");
      void pollOnce();
    };

    window.addEventListener("pageshow", onBack);
    document.addEventListener("visibilitychange", onBack);
    void loop();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.removeEventListener("pageshow", onBack);
      document.removeEventListener("visibilitychange", onBack);
    };
  }, [orderNo, opened]);

  const openPay = () => {
    if (!payUrl) return;
    setOpened(true);
    try {
      sessionStorage.setItem(`payUrl:${orderNo}`, payUrl);
      sessionStorage.setItem(`payLeft:${orderNo}`, "1");
    } catch {
      /* ignore */
    }

    if (isMobilePayContext()) {
      setStatusText("正在打开支付…付完后请用系统返回键回到大黄书。");
      window.location.assign(payUrl);
      return;
    }

    setStatusText("已打开支付窗口。付完后回到本页，或点「我已完成支付」。");
    const win = window.open(payUrl, "_blank", "noopener,noreferrer");
    if (!win) window.location.assign(payUrl);
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
      setStatusText("尚未到账。若已付款，请稍等再点一次。");
    } catch {
      setStatusText("确认失败，请稍后重试。");
    }
  };

  return (
    <div className="wrap page pay-wait-page">
      <section className="pay-wait-card" aria-live="polite">
        <p className="kicker">支付</p>
        <h1>{paid ? "充值成功" : "完成付款"}</h1>
        <p className="intro">{statusText}</p>
        <ul className="pay-wait-steps">
          <li>
            <em>1</em>
            <span>打开支付页，用微信 / 支付宝付款</span>
          </li>
          <li>
            <em>2</em>
            <span>{mobile ? "付完后点系统「返回」回到大黄书" : "付完后回到本页等待页"}</span>
          </li>
          <li>
            <em>3</em>
            <span>点「我已完成支付」，或等待自动到账</span>
          </li>
        </ul>
      </section>

      <div className="pay-wait-dock">
        <button className="btn solid" type="button" onClick={openPay}>
          {opened ? "重新打开支付" : "打开支付"}
        </button>
        <button className="btn solid pay-wait-confirm" type="button" onClick={() => void checkNow()}>
          我已完成支付
        </button>
        <div className="pay-wait-links">
          <a href={`/pay/r/${encodeURIComponent(orderNo)}`}>查看结果</a>
          <a href={walletHref.startsWith("http") ? "/wallet" : walletHref}>返回钱包</a>
        </div>
      </div>
    </div>
  );
}
