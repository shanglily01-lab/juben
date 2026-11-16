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
      <p className="kicker">账号</p>
      <h1>登录墨本</h1>
      <p className="intro">登录后可以投稿、看审核结果，并用金币解锁付费篇。邮箱还没激活的话，会先回到激活页。</p>
      <AuthForm mode="login" next={next} />
      <p>
        <a href={`/activate?next=${encodeURIComponent(next)}`}>没收到激活信</a>
      </p>
    </div>
  );
}
