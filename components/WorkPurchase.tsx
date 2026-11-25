"use client";

import { useEffect, useId, useState, useTransition } from "react";

import { AuthForm } from "@/components/AuthForm";
import { BUYOUT_YUAN, PAY_CHANNELS, type PayChannelId, yuanLabel } from "@/lib/pricing";

type PayKind = "unlock" | "buyout";

export function WorkPurchase({
  workId,
  yuan,
  loggedIn,
  unlocked,
  buyout,
  takenByOther = false,
}: {
  workId: number;
  yuan: number;
  loggedIn: boolean;
  unlocked: boolean;
  buyout: boolean;
  /** 已被别人独占买断 */
  takenByOther?: boolean;
}) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [payKind, setPayKind] = useState<PayKind>("unlock");
  const [channel, setChannel] = useState<PayChannelId>("005");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const next = `/works/${workId}`;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function openPay(kind: PayKind) {
    setPayKind(kind);
    setError("");
    setOpen(true);
  }

  if (takenByOther) {
    return (
      <div className="work-buy">
        <strong className="work-price">{yuanLabel(yuan)}</strong>
        <button className="btn solid buyout-done" type="button" disabled>
          已被买断
        </button>
      </div>
    );
  }

  if (buyout) {
    return (
      <div className="work-buy">
        <strong className="work-price">{yuanLabel(yuan)}</strong>
        <button className="btn solid buyout-done" type="button" disabled>
          已买断
        </button>
        <a className="btn ghost" href={`/api/works/${workId}/download`} download>
          免费下载
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="work-buy">
        <strong className="work-price">{yuanLabel(yuan)}</strong>
        {unlocked ? (
          <>
            <span className="work-owned">已购买</span>
            <a className="btn ghost" href={`/api/works/${workId}/download`} download>
              免费下载
            </a>
            <button type="button" className="btn solid" onClick={() => openPay("buyout")}>
              买断 {yuanLabel(BUYOUT_YUAN)}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn solid" onClick={() => openPay("unlock")}>
              购买
            </button>
            <button type="button" className="btn ghost" onClick={() => openPay("buyout")}>
              买断 {yuanLabel(BUYOUT_YUAN)}
            </button>
          </>
        )}
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
                <h2 id={titleId}>登录后购买</h2>
                <p className="hint">
                  本篇购买 {yuanLabel(yuan)}，买断 {yuanLabel(BUYOUT_YUAN)}。先登录或注册。
                </p>
                <div className="auth-modal-tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={authMode === "login"}
                    className={authMode === "login" ? "active" : undefined}
                    onClick={() => setAuthMode("login")}
                  >
                    登录
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={authMode === "register"}
                    className={authMode === "register" ? "active" : undefined}
                    onClick={() => setAuthMode("register")}
                  >
                    注册
                  </button>
                </div>
                <AuthForm key={authMode} mode={authMode} next={next} embedded />
              </>
            ) : (
              <>
                <h2 id={titleId}>{payKind === "buyout" ? "买断本篇" : "购买本篇"}</h2>
                <p className="hint">
                  {payKind === "buyout"
                    ? `买断价 ${yuanLabel(BUYOUT_YUAN)}。买断后仅你可阅读本篇，其他人将无法再看，按钮置灰。`
                    : `按质量计价 ${yuanLabel(yuan)}，解锁全文后可阅读并免费下载。`}
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
                          body: JSON.stringify({ kind: payKind, workId, channel }),
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
                  {pending
                    ? "正在跳转…"
                    : `支付 ${yuanLabel(payKind === "buyout" ? BUYOUT_YUAN : yuan)}`}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
