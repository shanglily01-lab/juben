"use client";

import { useId, useState, useTransition } from "react";

import { AuthForm } from "@/components/AuthForm";
import { PAY_CHANNELS, type PayChannelId, yuanLabel } from "@/lib/pricing";

export function RequirementPay({
  requirementId,
  title,
  yuan,
  loggedIn,
  autoOpen = false,
}: {
  requirementId: number;
  title: string;
  yuan: number;
  loggedIn: boolean;
  autoOpen?: boolean;
}) {
  const titleId = useId();
  const [open, setOpen] = useState(autoOpen);
  const [channel, setChannel] = useState<PayChannelId>("005");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const next = `/requirements/${requirementId}?pay=1`;

  return (
    <>
      <div className="req-pay">
        <p className="req-bounty">{yuanLabel(yuan)}</p>
        <button className="btn solid" type="button" onClick={() => setOpen(true)}>
          支付赏金
        </button>
      </div>
      {open ? (
        <div
          className="auth-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <button type="button" className="auth-modal-close" aria-label="关闭" onClick={() => setOpen(false)}>
              ×
            </button>
            {!loggedIn ? (
              <>
                <h2 id={titleId}>登录后付款</h2>
                <p className="hint">支付赏金 {yuanLabel(yuan)} 后开始制作。</p>
                <AuthForm mode="login" next={next} embedded />
              </>
            ) : (
              <>
                <h2 id={titleId}>支付征稿赏金</h2>
                <p className="hint">
                  《{title}》· {yuanLabel(yuan)}
                </p>
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
                <button
                  type="button"
                  className="btn solid"
                  disabled={pending}
                  onClick={() => {
                    setError("");
                    start(async () => {
                      try {
                        const response = await fetch("/api/pay/create", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ kind: "requirement", requirementId, channel }),
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
                  {pending ? "跳转支付中…" : `去支付 ${yuanLabel(yuan)}`}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
