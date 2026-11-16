"use client";

import { useActionState } from "react";

import { activateAction, resendActivationAction } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";
import type { ActionState } from "@/lib/types";

const initial: ActionState = { error: "" };

export function ActivateConfirm({ token, next }: { token: string; next: string }) {
  const [state, action] = useActionState(activateAction, initial);
  return (
    <form className="form" action={action}>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="next" value={next} />
      {state.error ? (
        <p className="alert" role="alert">
          {state.error}
        </p>
      ) : null}
      <SubmitButton idle="激活账号" pending="正在激活…" />
    </form>
  );
}

export function ResendForm({ email, next }: { email: string; next: string }) {
  const [state, action] = useActionState(resendActivationAction, initial);
  return (
    <form className="form" action={action}>
      <input type="hidden" name="next" value={next} />
      <label className="field">
        <span>邮箱</span>
        <input name="email" type="email" required defaultValue={email} autoComplete="email" placeholder="you@example.com" />
      </label>
      {state.error ? (
        <p className="alert" role="alert">
          {state.error}
        </p>
      ) : null}
      <SubmitButton idle="再发一封" pending="正在发送…" />
    </form>
  );
}
