"use client";

import { useState, useTransition } from "react";

import { PayChannelPicker } from "@/components/PayChannelPicker";
import { PACKS } from "@/lib/coins";
import { type PayChannelId, yuanLabel } from "@/lib/pricing";

export function PackList() {
  const [channel, setChannel] = useState<PayChannelId>("005");
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="packs-wrap">
      <PayChannelPicker value={channel} onChange={setChannel} disabled={pending} />
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      <div className="packs">
        {PACKS.map((pack) => (
          <div className="pack" key={pack.id}>
            <div className="pack-info">
              <span className="pack-label">{pack.label}</span>
              <p className="pack-coins">
                <strong>{pack.coins}</strong>
                <small>金币</small>
              </p>
              <p className="hint">约 {Math.round(pack.coins / pack.yuan)} 金 / 元</p>
            </div>
            <button
              className="btn solid"
              type="button"
              disabled={pending}
              onClick={() => {
                setError("");
                setPendingId(pack.id);
                start(async () => {
                  try {
                    const response = await fetch("/api/pay/create", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ kind: "topup", packId: pack.id, channel }),
                    });
                    const data = (await response.json()) as {
                      ok?: boolean;
                      msg?: string;
                      payUrl?: string;
                      mchOrderNo?: string;
                    };
                    if (!data.ok || !data.mchOrderNo) {
                      setError(data.msg || "下单失败");
                      setPendingId("");
                      return;
                    }
                    // 先进入本站等待页；支付在新窗口打开（上游收银台通常不回跳）
                    try {
                      sessionStorage.setItem("pendingTopup", data.mchOrderNo);
                      if (data.payUrl) sessionStorage.setItem(`payUrl:${data.mchOrderNo}`, data.payUrl);
                    } catch {
                      /* ignore */
                    }
                    if (data.payUrl) {
                      window.open(data.payUrl, "_blank", "noopener,noreferrer");
                    }
                    location.href = `/pay/go?orderNo=${encodeURIComponent(data.mchOrderNo)}`;
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "网络异常");
                    setPendingId("");
                  }
                });
              }}
            >
              {pending && pendingId === pack.id ? "跳转支付…" : yuanLabel(pack.yuan)}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
