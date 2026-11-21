"use client";

import { useActionState, useState } from "react";

import { loginAction, registerAction } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { INVITEE_COINS, INVITER_COINS, SIGNUP_COINS } from "@/lib/coins";
import type { ActionState } from "@/lib/types";

const initial: ActionState = { error: "" };

export function AuthForm({
  mode,
  next,
  invite = "",
}: {
  mode: "login" | "register";
  next: string;
  invite?: string;
}) {
  const action = mode === "login" ? loginAction : registerAction;
  const [state, formAction] = useActionState(action, initial);
  const [inviteCode, setInviteCode] = useState(invite);
  const alt =
    mode === "login" ? `/register?next=${encodeURIComponent(next)}` : `/login?next=${encodeURIComponent(next)}`;
  const signupLabel = "发送激活信";

  return (
    <form className="form" action={formAction}>
      <input type="hidden" name="next" value={next} />
      {mode === "register" ? (
        <label className="field">
          <span>名字</span>
          <input name="username" required minLength={2} maxLength={16} autoComplete="username" placeholder="怎么称呼你" />
        </label>
      ) : null}
      <label className="field">
        <span>{mode === "login" ? "名字或邮箱" : "邮箱"}</span>
        <input
          name={mode === "login" ? "login" : "email"}
          required
          autoComplete={mode === "login" ? "username" : "email"}
          inputMode={mode === "register" ? "email" : undefined}
          placeholder={mode === "login" ? "注册时的名字或邮箱" : "you@example.com"}
        />
      </label>
      <label className="field">
        <span>密码</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </label>
      {mode === "register" ? (
        <label className="field">
          <span>邀请码，可以不填</span>
          <input
            name="invite"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="好友发给你的邀请码"
          />
          <span className="hint">
            邮箱激活后到账 {SIGNUP_COINS} 金币。有效邀请码再加 {INVITEE_COINS}，对方得到 {INVITER_COINS}。
          </span>
        </label>
      ) : null}
      {state.error ? (
        <p className="alert" role="alert">
          {state.error}
        </p>
      ) : null}
      <SubmitButton idle={mode === "login" ? "登录" : signupLabel} pending="请稍等…" />
      <div className="auth-links">
        <a href={alt}>{mode === "login" ? "去注册" : "去登录"}</a>
        {mode === "login" ? <a href={`/activate?next=${encodeURIComponent(next)}`}>没收到激活信</a> : null}
      </div>
    </form>
  );
}
