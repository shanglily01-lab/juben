"use client";

import { useActionState, useEffect, useState } from "react";

import { loginAction, registerAction } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { INVITEE_COINS, INVITER_COINS, SIGNUP_COINS } from "@/lib/coins";
import type { ActionState } from "@/lib/types";

const initial: ActionState = { error: "" };
const LOGIN_CACHE_KEY = "dahuangshu_login_cache";

type LoginCache = { login: string; password: string };

function readLoginCache(): LoginCache | null {
  try {
    const raw = localStorage.getItem(LOGIN_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as LoginCache;
    if (!data || typeof data.login !== "string" || typeof data.password !== "string") return null;
    return { login: data.login, password: data.password };
  } catch {
    return null;
  }
}

function writeLoginCache(login: string, password: string) {
  try {
    localStorage.setItem(LOGIN_CACHE_KEY, JSON.stringify({ login, password }));
  } catch {
    /* ignore */
  }
}

export function AuthForm({
  mode,
  next,
  invite = "",
  embedded = false,
}: {
  mode: "login" | "register";
  next: string;
  invite?: string;
  /** 弹层内嵌时隐藏「去登录/去注册」外链，由外层 tabs 切换。 */
  embedded?: boolean;
}) {
  const action = mode === "login" ? loginAction : registerAction;
  const [state, formAction] = useActionState(action, initial);
  const [inviteCode, setInviteCode] = useState(invite);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const alt =
    mode === "login" ? `/register?next=${encodeURIComponent(next)}` : `/login?next=${encodeURIComponent(next)}`;
  const signupLabel = "发送激活信";

  useEffect(() => {
    if (mode !== "login") return;
    const cached = readLoginCache();
    if (!cached) return;
    setLoginId(cached.login);
    setPassword(cached.password);
    setRemember(true);
  }, [mode]);

  return (
    <form
      className="form"
      action={formAction}
      onSubmit={() => {
        if (mode !== "login") return;
        if (remember) writeLoginCache(loginId.trim(), password);
        else {
          try {
            localStorage.removeItem(LOGIN_CACHE_KEY);
          } catch {
            /* ignore */
          }
        }
      }}
    >
      <input type="hidden" name="next" value={next} />
      {mode === "register" ? (
        <label className="field">
          <span>名字</span>
          <input name="username" required minLength={2} maxLength={16} autoComplete="username" placeholder="怎么称呼你" />
        </label>
      ) : null}
      <label className="field">
        <span>{mode === "login" ? "名字或邮箱" : "邮箱"}</span>
        {mode === "login" ? (
          <input
            name="login"
            required
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
            autoComplete="username"
            placeholder="注册时的名字或邮箱"
          />
        ) : (
          <input name="email" required autoComplete="email" inputMode="email" placeholder="you@example.com" />
        )}
        {mode === "register" ? (
          <span className="hint">激活信发出后请查收；若收件箱没有，到垃圾邮件 / 促销邮件里找一下。</span>
        ) : null}
      </label>
      <label className="field">
        <span>密码</span>
        {mode === "login" ? (
          <input
            name="password"
            type="password"
            required
            minLength={8}
            maxLength={72}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        ) : (
          <input
            name="password"
            type="password"
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
          />
        )}
      </label>
      {mode === "login" ? (
        <label className="check-row">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          <span>记住账号和密码（保存在本机浏览器）</span>
        </label>
      ) : null}
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
      {embedded ? (
        mode === "login" ? (
          <p className="hint" style={{ marginTop: 10 }}>
            <a href={`/activate?next=${encodeURIComponent(next)}`}>没收到激活信</a>
          </p>
        ) : null
      ) : (
        <div className="auth-links">
          <a href={alt}>{mode === "login" ? "去注册" : "去登录"}</a>
          {mode === "login" ? <a href={`/activate?next=${encodeURIComponent(next)}`}>没收到激活信</a> : null}
        </div>
      )}
    </form>
  );
}
