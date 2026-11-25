import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PackList } from "@/components/PackList";
import { getCurrentUser } from "@/lib/auth";
import { CHECKIN_REWARDS, INVITEE_COINS, INVITER_COINS, SIGNUP_COINS } from "@/lib/coins";
import { listLedger } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "金币充值" };

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
    <div className="wrap page wallet-page">
      <p className="kicker">钱包</p>
      <h1>金币充值</h1>

      <section className="gold-wallet wallet-hero" aria-label="余额">
        <div className="gold-wallet-main">
          <span className="hint">当前可用</span>
          <p className="balance">
            {user.coins}
            <small>金币</small>
          </p>
          <p className="gold-tip">1 元 = 10 金币 · 微信 / 支付宝只用于充值</p>
        </div>
      </section>

      {params.ok === "1" ? <p className="note">充值已到账。</p> : null}
      {need > 0 && user.coins < need ? (
        <p className="note">本次大约还需要 {need - user.coins} 金，选一档充值即可。</p>
      ) : null}

      <div className="earn-strip" aria-label="免费得币">
        <a className="earn-chip" href="/checkin">
          <strong>签到</strong>
          <span>最高 +{CHECKIN_REWARDS[CHECKIN_REWARDS.length - 1]}</span>
        </a>
        <a className="earn-chip" href="/invite">
          <strong>邀请</strong>
          <span>你得 +{INVITER_COINS}</span>
        </a>
        <div className="earn-chip static">
          <strong>注册</strong>
          <span>激活 +{SIGNUP_COINS}</span>
        </div>
      </div>

      <div className="section-title">
        <h2>选择档位</h2>
      </div>
      <PackList />

      <ul className="rules wallet-rules">
        <li>解锁单篇、买断、征稿赏金一律扣金币。</li>
        <li>
          邀请好友激活后，你得 {INVITER_COINS}，对方额外得 {INVITEE_COINS}。
        </li>
        <li>充值按档位真实付款，到账后即可消费。</li>
      </ul>

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
