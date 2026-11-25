import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PackList } from "@/components/PackList";
import { getCurrentUser } from "@/lib/auth";
import { CHECKIN_REWARDS, INVITEE_COINS, INVITER_COINS, SIGNUP_COINS } from "@/lib/coins";
import { listLedger } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "金币" };

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; need?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/wallet");
  const params = await searchParams;
  const entries = listLedger(user.id);
  const need = Math.max(0, Math.floor(Number(params.need) || 0));

  return (
    <div className="wrap page">
      <p className="kicker">钱包</p>
      <h1>金币</h1>
      <p className="balance">
        {user.coins}
        <small>可用</small>
      </p>
      <p className="intro">1 元 = 10 金。微信 / 支付宝只用于充值；解锁、买断、征稿都扣金币。</p>
      {params.ok === "1" ? <p className="note">充值已到账。</p> : null}
      {need > 0 && user.coins < need ? (
        <p className="note">本次大约还需要 {need - user.coins} 金，选一档充值即可。</p>
      ) : null}
      <ul className="rules">
        <li>注册并激活邮箱后赠送 {SIGNUP_COINS} 金币。</li>
        <li>
          每日签到从 {CHECKIN_REWARDS[0]} 起，连续 7 天后每天 {CHECKIN_REWARDS[CHECKIN_REWARDS.length - 1]}。
          <a href="/checkin">去签到</a>
        </li>
        <li>
          邀请一位新用户，你得 {INVITER_COINS}，对方额外得 {INVITEE_COINS}。<a href="/invite">去邀请</a>
        </li>
        <li>充值按档位真实付款，到账后即可消费。</li>
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
