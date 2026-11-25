"use client";

import { useState, useTransition } from "react";

import { PACKS } from "@/lib/coins";
import { PAY_CHANNELS, type PayChannelId, yuanLabel } from "@/lib/pricing";

export function PackList() {
  const [channel, setChannel] = useState<PayChannelId>("005");
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="packs-wrap">
      <div className="pay-channels" role="group" aria-label="支付方式">
        {PAY_CHANNELS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`pay-channel${channel === item.id ? " active" : ""}`}
            disabled={pending}
            onClick={() => setChannel(item.id)}
          >
            {item.label}
            <small>{item.id}</small>
          </button>
        ))}
      </div>
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
                    const data = (await response.json()) as { ok?: boolean; msg?: string; payUrl?: string };
                    if (!data.ok || !data.payUrl) {
                      setError(data.msg || "下单失败");
                      setPendingId("");
                      return;
                    }
                    location.href = data.payUrl;
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
