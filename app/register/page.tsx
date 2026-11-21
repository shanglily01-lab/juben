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
      <section className="auth">
        <span className="auth-seal" aria-hidden>
          书
        </span>
        <p className="kicker">大黄书</p>
        <h1>注册</h1>
        <p className="intro">
          {invite
            ? `邀请码 ${invite.toUpperCase()} 已填好。激活后到账 ${SIGNUP_COINS} 金币，有效邀请再加 ${INVITEE_COINS}。`
            : `短剧和小说共用一个账号。激活邮箱后到账 ${SIGNUP_COINS} 金币。`}
        </p>
        <AuthForm mode="register" next={next} invite={invite} />
      </section>
    </div>
  );
}
