import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ActivateConfirm, ResendForm } from "@/components/ActivationForms";
import { getCurrentUser } from "@/lib/auth";
import { safeNext } from "@/lib/format";
import { latestOutboxLink, showMailPreview } from "@/lib/mail";

export const metadata: Metadata = { title: "激活" };

export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<{
    token?: string;
    sent?: string;
    email?: string;
    next?: string;
    failed?: string;
    resent?: string;
    pending?: string;
  }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next, "/mine");
  const token = (params.token ?? "").trim();
  const email = (params.email ?? "").trim().toLowerCase();
  const current = await getCurrentUser();
  if (current && !token) redirect(next);

  if (token) {
    return (
      <div className="wrap page">
        <p className="kicker">账号</p>
        <h1>激活账号</h1>
        <p className="intro">确认这是你的邮箱。激活之后才能登录，注册赠送也会在这一步入账。</p>
        <ActivateConfirm token={token} next={next} />
      </div>
    );
  }

  const preview = email && showMailPreview() ? latestOutboxLink(email) : "";

  return (
    <div className="wrap page">
      <p className="kicker">账号</p>
      <h1>去邮箱激活</h1>
      {params.pending === "1" ? <p className="note">这个邮箱还没激活，现在还不能登录。</p> : null}
      {params.resent === "1" ? <p className="note">又发了一封激活信。</p> : null}
      {params.failed === "1" ? <p className="alert">激活信没有发出去，可以马上再发一次。</p> : null}
      <p className="intro">
        {email && params.failed === "1"
          ? `上一封没能送到 ${email}。`
          : email && params.pending === "1"
            ? `${email} 还没激活，所以这次登录没有进去。需要的话再发一封。`
            : email
              ? `激活信发往 ${email}。24 小时内打开链接，账号和金币才会生效。`
              : "填写注册时的邮箱，可以再发一封激活信。"}
      </p>
      {preview ? (
        <>
          <p className="note">这台服务器还没配置发信，信先留在本机。用下面的链接完成激活。</p>
          <a className="activate-link" href={preview}>
            {preview}
          </a>
        </>
      ) : null}
      <ResendForm email={email} next={next} />
      <a href={`/login?next=${encodeURIComponent(next)}`}>已经激活，去登录</a>
    </div>
  );
}
