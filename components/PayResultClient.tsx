"use client";

import { useEffect, useState } from "react";

/** 支付结果页：轮询到账后相对路径回钱包。 */
export function PayResultClient({
  orderNo,
  loginUrl,
}: {
  orderNo: string;
  walletOkUrl?: string;
  walletUrl?: string;
  loginUrl: string;
}) {
  const [text, setText] = useState("正在确认支付结果…");
  const [done, setDone] = useState<"ok" | "fail" | "wait" | null>(null);

  useEffect(() => {
    if (!orderNo) {
      setText("缺少订单号，请打开钱包查看是否到账。");
      setDone("fail");
      return;
    }
    try {
      sessionStorage.setItem("pendingTopup", orderNo);
    } catch {
      /* ignore */
    }

    let stopped = false;
    let tries = 0;

    const jump = (path: string) => {
      try {
        window.location.replace(path);
      } catch {
        window.location.href = path;
      }
    };

    const tick = async () => {
      tries += 1;
      try {
        const response = await fetch(`/api/pay/query?orderNo=${encodeURIComponent(orderNo)}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (response.status === 401) {
          setText("登录已失效，正在重新登录…");
          jump(loginUrl.startsWith("http") ? loginUrl : `/login?next=${encodeURIComponent(`/pay/r/${orderNo}`)}`);
          return;
        }
        const data = (await response.json()) as { order?: { payStatus?: string } };
        const status = String(data.order?.payStatus || "").toUpperCase();
        if (status === "SUCCESS") {
          setText("充值成功，正在返回钱包…");
          setDone("ok");
          try {
            sessionStorage.removeItem("pendingTopup");
            sessionStorage.removeItem(`payLeft:${orderNo}`);
          } catch {
            /* ignore */
          }
          jump("/wallet?ok=1");
          return;
        }
        if (["FAIL", "TIMEOUT", "EXCEPTION", "CLOSE"].includes(status)) {
          setText("支付未完成，可返回钱包重试。");
          setDone("fail");
          return;
        }
        setDone("wait");
        setText(tries > 2 ? `正在确认…（第 ${tries} 次）` : "正在确认支付结果…");
      } catch {
        /* keep */
      }
      if (!stopped && tries < 50) window.setTimeout(tick, 1000);
      else if (!stopped) {
        setText("仍在等待结果，可打开钱包查看是否已到账。");
        setDone("wait");
      }
    };

    void tick();
    return () => {
      stopped = true;
    };
  }, [orderNo, loginUrl]);

  return (
    <div className="wrap page pay-wait-page">
      <section className="pay-wait-card">
        <p className="kicker">支付回跳</p>
        <h1>{done === "ok" ? "充值成功" : done === "fail" ? "支付未完成" : "支付结果"}</h1>
        <p className="intro">{text}</p>
      </section>
      <div className="pay-wait-dock">
        <a className="btn solid" href={done === "ok" ? "/wallet?ok=1" : "/wallet"}>
          {done === "ok" ? "返回钱包" : "打开钱包"}
        </a>
        {done === "wait" || done === null ? (
          <button type="button" className="btn ghost" onClick={() => window.location.reload()}>
            刷新结果
          </button>
        ) : null}
      </div>
    </div>
  );
}
