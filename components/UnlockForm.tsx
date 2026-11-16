"use client";

import { useActionState } from "react";

import { unlockAction } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";
import type { ActionState } from "@/lib/types";

const initial: ActionState = { error: "" };

export function UnlockForm({
  workId,
  price,
  coins,
  loggedIn,
  loginHref,
}: {
  workId: number;
  price: number;
  coins: number;
  loggedIn: boolean;
  loginHref: string;
}) {
  const [state, formAction] = useActionState(unlockAction, initial);

  return (
    <div className="paydock">
      <p>
        {loggedIn
          ? `解锁全文需要 ${price} 金币，你现在有 ${coins} 金币。解锁后可以反复阅读。`
          : `解锁全文需要 ${price} 金币。登录后即可解锁，解锁后可以反复阅读。`}
      </p>
      {state.error ? (
        <p className="alert" role="alert">
          {state.error}
        </p>
      ) : null}
      {!loggedIn ? (
        <a className="btn solid" href={loginHref}>
          登录后解锁
        </a>
      ) : coins < price ? (
        <a className="btn solid" href="/wallet">
          金币不足，去充值
        </a>
      ) : (
        <form action={formAction}>
          <input type="hidden" name="workId" value={workId} />
          <SubmitButton idle="解锁全文" pending="正在解锁…" />
        </form>
      )}
    </div>
  );
}
