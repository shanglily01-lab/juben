import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CopyField } from "@/components/CopyField";
import { getCurrentUser } from "@/lib/auth";
import { INVITEE_COINS, INVITER_COINS } from "@/lib/coins";
import { getInviteProfile } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { requestOrigin } from "@/lib/origin";

export const metadata: Metadata = { title: "邀请" };

export default async function InvitePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/invite");
  const profile = getInviteProfile(user.id);
  const origin = await requestOrigin();
  const link = `${origin || ""}/register?invite=${profile.code}`;

  return (
    <div className="wrap page">
      <p className="kicker">邀请</p>
      <h1>把大黄书剧本小说网递给朋友</h1>
      <p className="intro">
        朋友用你的邀请码注册，并激活邮箱后，你得到 {INVITER_COINS} 金币，对方在注册赠送之外再得 {INVITEE_COINS} 金币。已经有账号的人不能补填。
      </p>
      <p className="invite-code">{profile.code}</p>
      <CopyField value={link} />
      <div className="pair">
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
