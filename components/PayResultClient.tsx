"use client";

import { useEffect, useState } from "react";

/**
 * 支付回跳结果：客户端轮询查单。
 * 不用 meta refresh / 内联 script（App Router 里经常不执行，付完会卡死不动）。
 */
export function PayResultClient({
  orderNo,
  walletOkUrl,
  walletUrl,
  loginUrl,
}: {
  orderNo: string;
  walletOkUrl: string;
  walletUrl: string;
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

    const goWallet = (ok: boolean) => {
      const target = ok ? walletOkUrl : walletUrl;
      try {
        if (ok) sessionStorage.removeItem("pendingTopup");
      } catch {
        /* ignore */
      }
      // 整页跳转，避免支付 WebView 里客户端路由丢域
      window.location.replace(target);
    };

    const tick = async () => {
      tries += 1;
      try {
        const response = await fetch(`/api/pay/query?orderNo=${encodeURIComponent(orderNo)}`, {
          cache: "no-store",
        });
        if (response.status === 401) {
          setText("登录已失效，正在重新登录…");
          window.location.replace(loginUrl);
          return;
        }
        const data = (await response.json()) as {
          ok?: boolean;
          order?: { payStatus?: string };
        };
        const status = data.order?.payStatus || "";
        if (status === "SUCCESS") {
          setText("充值成功，正在返回钱包…");
          setDone("ok");
          goWallet(true);
          return;
        }
        if (["FAIL", "TIMEOUT", "EXCEPTION", "CLOSE"].includes(status)) {
          setText("支付未完成，可返回钱包重试。");
          setDone("fail");
          return;
        }
        setDone("wait");
        setText("正在确认支付结果…");
      } catch {
        /* keep polling */
      }
      if (!stopped && tries < 40) {
        window.setTimeout(tick, 1200);
      } else if (!stopped) {
        setText("仍在等待支付结果，可稍后打开钱包查看。");
        setDone("wait");
      }
    };

    void tick();
    return () => {
      stopped = true;
    };
  }, [orderNo, walletOkUrl, walletUrl, loginUrl]);

  return (
    <div className="wrap page">
      <p className="kicker">支付回跳</p>
      <h1>{done === "ok" ? "充值成功" : done === "fail" ? "支付未完成" : "支付结果"}</h1>
      <p className="intro">{text}</p>
      <p className="stack" style={{ marginTop: 16 }}>
        <a className="btn solid" href={done === "ok" ? walletOkUrl : walletUrl}>
          {done === "ok" ? "返回钱包" : "打开钱包"}
        </a>
        {done === "wait" || done === null ? (
          <button
            type="button"
            className="btn ghost"
            onClick={() => window.location.reload()}
          >
            刷新结果
          </button>
        ) : null}
      </p>
    </div>
  );
}
