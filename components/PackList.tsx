"use client";

import { useState, useTransition } from "react";

import { PayChannelPicker } from "@/components/PayChannelPicker";
import { PACKS } from "@/lib/coins";
import { type PayChannelId, yuanLabel } from "@/lib/pricing";

export function PackList() {
  // 对齐青果：默认支付宝，成功率更高
  const [channel, setChannel] = useState<PayChannelId>("004");
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="packs-wrap">
      <p className="pay-tip-note" role="note">
        为了保证支付成功率，请优先使用<strong>支付宝</strong>付款
      </p>
      <PayChannelPicker value={channel} onChange={setChannel} disabled={pending} />
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      <div className="packs">
        {PACKS.map((pack) => (
          <div className={`pack${pending && pendingId === pack.id ? " is-busy" : ""}`} key={pack.id}>
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
                    try {
                      sessionStorage.setItem("pendingTopup", data.mchOrderNo);
                      if (data.payUrl) sessionStorage.setItem(`payUrl:${data.mchOrderNo}`, data.payUrl);
                    } catch {
                      /* ignore */
                    }
                    // 先进等待页，由等待页按青果方式打开收银台（避免本页误跳）
                    location.href = `/pay/go?orderNo=${encodeURIComponent(data.mchOrderNo)}`;
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "网络异常");
                    setPendingId("");
                  }
                });
              }}
            >
              {pending && pendingId === pack.id ? "创建订单…" : yuanLabel(pack.yuan)}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
