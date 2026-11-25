import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PackList } from "@/components/PackList";
import { getCurrentUser } from "@/lib/auth";
import { CHECKIN_REWARDS, INVITEE_COINS, INVITER_COINS, SIGNUP_COINS } from "@/lib/coins";
import { listLedger } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "金币" };

export default async function WalletPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/wallet");
  const params = await searchParams;
  const entries = listLedger(user.id);

  return (
    <div className="wrap page">
      <p className="kicker">钱包</p>
      <h1>金币</h1>
      <p className="balance">
        {user.coins}
        <small>可用</small>
      </p>
      <p className="intro">同一份余额可以解锁短剧。签到、邀请和演示充值都记在下面的流水里。</p>
      {params.ok === "1" ? <p className="note">演示充值已到账。</p> : null}
      <ul className="rules">
        <li>注册并激活邮箱后赠送 {SIGNUP_COINS} 金币。</li>
        <li>
          每日签到从 {CHECKIN_REWARDS[0]} 起，连续 7 天后每天 {CHECKIN_REWARDS[CHECKIN_REWARDS.length - 1]}。
          <a href="/checkin">去签到</a>
        </li>
        <li>
          邀请一位新用户，你得 {INVITER_COINS}，对方额外得 {INVITEE_COINS}。<a href="/invite">去邀请</a>
        </li>
        <li>演示充值确认后入账，不会产生真实扣款。</li>
      </ul>
      <div className="section-title">
        <h2>充值</h2>
      </div>
      <PackList />
      <div className="section-title">
        <h2>流水</h2>
      </div>
      {entries.length === 0 ? (
        <p className="empty">还没有进出账。</p>
      ) : (
        <ul className="ledger">
          {entries.map((entry) => (
            <li key={entry.id}>
              <span>
                {entry.reason}
                <br />
                <span className="hint">{formatDate(entry.created_at)}</span>
              </span>
              <span className={entry.delta > 0 ? "plus" : "minus"}>
                {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
