import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CopyField } from "@/components/CopyField";
import { getCurrentUser } from "@/lib/auth";
import { INVITEE_COINS, INVITER_COINS } from "@/lib/coins";
import { getInviteProfile } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { requestOrigin } from "@/lib/origin";

export const metadata: Metadata = { title: "邀请好友" };

export default async function InvitePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/invite");
  const profile = getInviteProfile(user.id);
  const origin = await requestOrigin();
  const link = `${origin || ""}/register?invite=${profile.code}`;

  return (
    <div className="wrap page invite-page">
      <p className="kicker">邀请</p>
      <h1>邀请好友得金币</h1>

      <section className="invite-hero" aria-label="邀请奖励">
        <p className="invite-hero-label">好友激活邮箱后</p>
        <div className="invite-hero-rewards">
          <div>
            <span className="hint">你获得</span>
            <p className="balance">
              +{INVITER_COINS}
              <small>金币</small>
            </p>
          </div>
          <div className="invite-hero-divider" aria-hidden />
          <div>
            <span className="hint">对方额外</span>
            <p className="balance">
              +{INVITEE_COINS}
              <small>金币</small>
            </p>
          </div>
        </div>
        <p className="gold-tip">已有账号不能补填邀请码 · 仅限新注册并激活</p>
      </section>

      <div className="invite-share panel">
        <span className="hint">你的邀请码</span>
        <p className="invite-code">{profile.code}</p>
        <CopyField value={link} />
      </div>

      <div className="pair invite-stats">
        <div className="panel">
          <span className="hint">成功邀请</span>
          <p className="balance">
            {profile.count}
            <small>人</small>
          </p>
        </div>
        <div className="panel">
          <span className="hint">因此得到</span>
          <p className="balance">
            {profile.earned}
            <small>金币</small>
          </p>
        </div>
      </div>

      {profile.invitedBy ? <p className="note">你由 {profile.invitedBy} 邀请而来。</p> : null}

      <div className="section-title">
        <h2>邀请记录</h2>
      </div>
      {profile.people.length === 0 ? (
        <p className="empty">还没有人通过你的邀请码注册。</p>
      ) : (
        <ul className="ledger">
          {profile.people.map((person) => (
            <li key={person.username}>
              <span>{person.username}</span>
              <span className="hint">{formatDate(person.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
