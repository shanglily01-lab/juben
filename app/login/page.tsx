import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";
import { safeNext } from "@/lib/format";

export const metadata: Metadata = { title: "登录" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const next = safeNext(params.next, "/mine");
  if (user) redirect(next);

  return (
    <div className="wrap page">
      <section className="auth">
        <span className="auth-seal" aria-hidden>
          书
        </span>
        <p className="kicker">大黄书</p>
        <h1>登录</h1>
        <p className="intro">投稿、看审核、解锁付费篇，都用这一个账号。</p>
        <AuthForm mode="login" next={next} />
      </section>
    </div>
  );
}
