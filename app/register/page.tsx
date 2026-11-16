import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";
import { INVITEE_COINS, SIGNUP_COINS } from "@/lib/coins";
import { safeNext } from "@/lib/format";

export const metadata: Metadata = { title: "注册" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; invite?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const next = safeNext(params.next, "/mine");
  if (user) redirect(next);
  const invite = (params.invite ?? "").trim();

  return (
    <div className="wrap page">
      <p className="kicker">账号</p>
      <h1>注册</h1>
      <p className="intro">
        {invite
          ? `邀请码 ${invite.toUpperCase()} 已填好。邮箱激活后到账 ${SIGNUP_COINS} 金币，邀请码有效再加 ${INVITEE_COINS} 金币。`
          : `一个账号同时用于短剧和小说。请到邮箱点开激活链接，激活后到账 ${SIGNUP_COINS} 金币。`}
      </p>
      <AuthForm mode="register" next={next} invite={invite} />
    </div>
  );
}
