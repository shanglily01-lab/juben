"use client";

import { useActionState, useId, useState } from "react";

import { AuthForm } from "@/components/AuthForm";
import { payRequirementAction } from "@/lib/actions";
import { coinLabel } from "@/lib/pricing";
import type { ActionState } from "@/lib/types";

const initial: ActionState = { error: "" };

export function RequirementPay({
  requirementId,
  title,
  coins,
  balance,
  loggedIn,
  autoOpen = false,
}: {
  requirementId: number;
  title: string;
  coins: number;
  balance: number;
  loggedIn: boolean;
  autoOpen?: boolean;
}) {
  const titleId = useId();
  const [open, setOpen] = useState(autoOpen);
  const [state, action, pending] = useActionState(payRequirementAction, initial);
  const next = `/requirements/${requirementId}?pay=1`;
  const enough = balance >= coins;

  return (
    <>
      <div className="req-pay">
        <p className="req-bounty">{coinLabel(coins)}</p>
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
                <p className="hint">支付赏金 {coinLabel(coins)} 后开始制作。</p>
                <AuthForm mode="login" next={next} embedded />
              </>
            ) : (
              <>
                <h2 id={titleId}>支付征稿赏金</h2>
                <p className="hint">
                  《{title}》· {coinLabel(coins)}。当前余额 {coinLabel(balance)}。
                </p>
                {state.error ? (
                  <p className="alert" role="alert">
                    {state.error}
                  </p>
                ) : null}
                {!enough ? (
                  <a className="btn solid" href={`/wallet?need=${coins}`}>
                    金币不足，去充值
                  </a>
                ) : (
                  <form action={action}>
                    <input type="hidden" name="requirementId" value={requirementId} />
                    <button className="btn solid" type="submit" disabled={pending}>
                      {pending ? "支付中…" : `支付 ${coinLabel(coins)}`}
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
