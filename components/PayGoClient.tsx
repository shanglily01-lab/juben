"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { openPayUrl } from "@/lib/pay-open";

const POLL_FIRST_MS = 2000;
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_MS = 5 * 60 * 1000;

/**
 * 对齐 https://lvgdj.com 瑞禾支付前台：
 * 本页建单后打开收银台（新窗口），本页轮询到账；付完不依赖上游回跳。
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
  const [statusText, setStatusText] = useState("支付处理中");
  const [paid, setPaid] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const openedRef = useRef(false);
  const stoppedRef = useRef(false);

  const clearPending = useCallback(() => {
    try {
      sessionStorage.removeItem("pendingTopup");
      sessionStorage.removeItem(`payLeft:${orderNo}`);
    } catch {
      /* ignore */
    }
  }, [orderNo]);

  const queryOnce = useCallback(async () => {
    const response = await fetch(`/api/pay/query?orderNo=${encodeURIComponent(orderNo)}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (response.status === 401) return { kind: "auth" as const };
    const data = (await response.json()) as { order?: { payStatus?: string } };
    const status = String(data.order?.payStatus || "").toUpperCase();
    if (status === "SUCCESS") return { kind: "ok" as const };
    if (["FAIL", "TIMEOUT", "EXCEPTION", "CLOSE"].includes(status)) {
      return { kind: "fail" as const, status };
    }
    return { kind: "wait" as const, status: status || "PROCESSING" };
  }, [orderNo]);

  useEffect(() => {
    if (!orderNo || !payUrl) return;
    stoppedRef.current = false;

    try {
      sessionStorage.setItem("pendingTopup", orderNo);
      sessionStorage.setItem(`payLeft:${orderNo}`, "1");
      sessionStorage.setItem(`payUrl:${orderNo}`, payUrl);
    } catch {
      /* ignore */
    }

    // 进入等待页即打开收银台（与青果一致：先开窗，本页留下轮询）
    if (!openedRef.current) {
      openedRef.current = true;
      openPayUrl(payUrl);
    }

    let timer = 0;
    let usedFirst = false;
    const startedAt = Date.now();
    let pendingWhileHidden = false;

    const finishOk = () => {
      setPaid(true);
      setStatusText("已完成");
      setConfirming(false);
      clearPending();
      window.setTimeout(() => {
        window.location.replace("/wallet?ok=1");
      }, 800);
    };

    const tick = async () => {
      if (stoppedRef.current) return;
      if (document.hidden) {
        pendingWhileHidden = true;
        return;
      }
      if (Date.now() - startedAt > POLL_MAX_MS) {
        setStatusText("查询超时，请点「我已支付」或刷新钱包查看");
        setConfirming(false);
        return;
      }
      try {
        const result = await queryOnce();
        if (stoppedRef.current) return;
        if (result.kind === "ok") {
          finishOk();
          return;
        }
        if (result.kind === "auth") {
          setStatusText("登录已失效，请重新登录");
          return;
        }
        if (result.kind === "fail") {
          setStatusText("支付未完成，可重新打开收银台或换支付宝重试");
          setConfirming(false);
          return;
        }
        setStatusText("支付处理中");
      } catch {
        /* 暂时失败，继续轮询 */
      }
      const delay = usedFirst ? POLL_INTERVAL_MS : POLL_FIRST_MS;
      usedFirst = true;
      timer = window.setTimeout(tick, delay);
    };

    const onVisibility = () => {
      if (!document.hidden && pendingWhileHidden && !stoppedRef.current) {
        pendingWhileHidden = false;
        void tick();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    timer = window.setTimeout(tick, POLL_FIRST_MS);

    return () => {
      stoppedRef.current = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [orderNo, payUrl, clearPending, queryOnce]);

  const reopen = () => {
    openPayUrl(payUrl);
    setStatusText("已重新打开收银台");
  };

  const markPaid = async () => {
    setConfirming(true);
    setStatusText("正在确认…");
    try {
      const result = await queryOnce();
      if (result.kind === "ok") {
        setPaid(true);
        setStatusText("已完成");
        clearPending();
        window.setTimeout(() => window.location.replace("/wallet?ok=1"), 600);
        return;
      }
      if (result.kind === "fail") {
        setStatusText("支付未完成，可重新打开收银台");
      } else if (result.kind === "auth") {
        setStatusText("登录已失效，请重新登录");
      } else {
        setStatusText("尚未到账，请稍候，系统仍在自动确认");
      }
    } catch {
      setStatusText("确认失败，请稍后重试");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="wrap page pay-wait-page">
      <section className="pay-wait-card" aria-live="polite">
        <p className="kicker">支付</p>
        <h1>{paid ? "充值成功" : "请完成付款"}</h1>
        <p className="mq-note-line">
          已打开收银台，请在新窗口完成支付。
          <br />
          订单号：{orderNo}
        </p>
        <p className="mq-note-line">状态：{statusText}</p>
        <p className="hint" style={{ marginTop: 10 }}>
          为提高成功率，建议使用支付宝。付完后回到本页即可，无需停在收银台等待跳转。
        </p>
      </section>

      <div className="pay-wait-dock">
        <button className="btn ghost" type="button" onClick={reopen}>
          重新打开收银台
        </button>
        <button className="btn solid" type="button" disabled={confirming || paid} onClick={() => void markPaid()}>
          {confirming ? "正在确认…" : paid ? "已完成" : "我已支付"}
        </button>
        <div className="pay-wait-links">
          <a href={`/pay/r/${encodeURIComponent(orderNo)}`}>查看结果</a>
          <a href={walletHref.startsWith("http") ? "/wallet" : walletHref}>返回钱包</a>
        </div>
      </div>
    </div>
  );
}
