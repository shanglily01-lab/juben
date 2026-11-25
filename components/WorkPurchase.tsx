"use client";

import { useActionState, useEffect, useId, useState } from "react";

import { AuthForm } from "@/components/AuthForm";
import { buyoutAction, unlockAction } from "@/lib/actions";
import { BUYOUT_COINS, coinLabel } from "@/lib/pricing";
import type { ActionState } from "@/lib/types";

const initial: ActionState = { error: "" };

type PayKind = "unlock" | "buyout";

export function WorkPurchase({
  workId,
  coins,
  balance,
  loggedIn,
  unlocked,
  buyout,
  takenByOther = false,
}: {
  workId: number;
  coins: number;
  balance: number;
  loggedIn: boolean;
  unlocked: boolean;
  buyout: boolean;
  takenByOther?: boolean;
}) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [payKind, setPayKind] = useState<PayKind>("unlock");
  const [unlockState, unlockFormAction, unlockPending] = useActionState(unlockAction, initial);
  const [buyoutState, buyoutFormAction, buyoutPending] = useActionState(buyoutAction, initial);
  const next = `/works/${workId}`;
  const cost = payKind === "buyout" ? BUYOUT_COINS : coins;
  const enough = balance >= cost;
  const error = payKind === "buyout" ? buyoutState.error : unlockState.error;
  const pending = unlockPending || buyoutPending;

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
    setOpen(true);
  }

  if (takenByOther) {
    return (
      <div className="work-buy">
        <strong className="work-price">{coinLabel(coins)}</strong>
        <button className="btn solid buyout-done" type="button" disabled>
          已被买断
        </button>
      </div>
    );
  }

  if (buyout) {
    return (
      <div className="work-buy">
        <strong className="work-price">{coinLabel(coins)}</strong>
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
        <strong className="work-price">{coinLabel(coins)}</strong>
        {unlocked ? (
          <>
            <span className="work-owned">已购买</span>
            <a className="btn ghost" href={`/api/works/${workId}/download`} download>
              免费下载
            </a>
            <button type="button" className="btn solid" onClick={() => openPay("buyout")}>
              买断 {coinLabel(BUYOUT_COINS)}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn solid" onClick={() => openPay("unlock")}>
              购买
            </button>
            <button type="button" className="btn ghost" onClick={() => openPay("buyout")}>
              买断 {coinLabel(BUYOUT_COINS)}
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
                  本篇 {coinLabel(coins)}，买断 {coinLabel(BUYOUT_COINS)}。先登录或注册。
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
                    ? `买断价 ${coinLabel(BUYOUT_COINS)}。买断后仅你可阅读，其他人无法再看。`
                    : `需 ${coinLabel(coins)}，解锁后可阅读并免费下载。`}
                  {` 当前余额 ${coinLabel(balance)}。`}
                </p>
                {error ? (
                  <p className="alert" role="alert">
                    {error}
                  </p>
                ) : null}
                {!enough ? (
                  <a className="btn solid" href={`/wallet?need=${cost}`}>
                    金币不足，去充值
                  </a>
                ) : (
                  <form action={payKind === "buyout" ? buyoutFormAction : unlockFormAction}>
                    <input type="hidden" name="workId" value={workId} />
                    <button className="btn solid" type="submit" disabled={pending}>
                      {pending ? "处理中…" : `支付 ${coinLabel(cost)}`}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
