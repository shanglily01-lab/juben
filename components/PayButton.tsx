"use client";

import { useState, useTransition } from "react";

import { PayChannelPicker } from "@/components/PayChannelPicker";
import { type PayChannelId } from "@/lib/pricing";

/** 单篇购买 / 买断；必须带 workId。 */
export function PayButton({
  kind,
  workId,
  label,
  disabled,
  className = "btn solid",
}: {
  kind: "buyout" | "unlock";
  workId: number;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const [channel, setChannel] = useState<PayChannelId>("005");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="pay-btn-wrap">
      <PayChannelPicker value={channel} onChange={setChannel} disabled={disabled || pending} />
      <button
        type="button"
        className={className}
        disabled={disabled || pending}
        onClick={() => {
          setError("");
          start(async () => {
            try {
              const response = await fetch("/api/pay/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ kind, workId, channel }),
              });
              const data = (await response.json()) as { ok?: boolean; msg?: string; payUrl?: string };
              if (!data.ok || !data.payUrl) {
                setError(data.msg || "下单失败");
                return;
              }
              location.href = data.payUrl;
            } catch (err) {
              setError(err instanceof Error ? err.message : "网络异常");
            }
          });
        }}
      >
        {pending ? "正在跳转支付…" : `${label} · ${channel === "005" ? "微信" : "支付宝"}`}
      </button>
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
