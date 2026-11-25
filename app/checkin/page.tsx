import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CheckinForm } from "@/components/CheckinForm";
import { getCurrentUser } from "@/lib/auth";
import { CHECKIN_REWARDS } from "@/lib/coins";
import { getCheckinState } from "@/lib/db";
import { shortDay } from "@/lib/format";

export const metadata: Metadata = { title: "每日签到" };

export default async function CheckinPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/checkin");
  const params = await searchParams;
  const state = getCheckinState(user.id);
  const activeIndex = Math.min(state.streak, CHECKIN_REWARDS.length) - 1;
  const maxReward = CHECKIN_REWARDS[CHECKIN_REWARDS.length - 1];

  return (
    <div className="wrap page checkin-page">
      <p className="kicker">签到</p>
      <h1>{state.checkedIn ? `连续 ${state.streak} 天` : "每日签到领金币"}</h1>

      <section className="checkin-hero" aria-label="今日奖励">
        <span className="hint">{state.checkedIn ? "今日已入账" : "现在签到可领"}</span>
        <p className="balance">
          +{state.reward}
          <small>金币</small>
        </p>
        <p className="gold-tip">
          连续满 7 天后每天 {maxReward} 金 · 断一天从 {CHECKIN_REWARDS[0]} 重新开始 · 按北京时间计日
        </p>
      </section>

      {params.ok === "1" ? <p className="note">签到成功，金币已入账。</p> : null}

      <ol className="ladder">
        {CHECKIN_REWARDS.map((coins, index) => {
          const done = state.checkedIn ? index <= activeIndex : index < activeIndex;
          const today = index === activeIndex;
          const className = [done ? "done" : "", today ? "today" : ""].filter(Boolean).join(" ");
          return (
            <li key={coins} className={className}>
              <strong>+{coins}</strong>
              <span>{index + 1} 天</span>
            </li>
          );
        })}
      </ol>

      <CheckinForm checkedIn={state.checkedIn} reward={state.reward} />

      <div className="section-title">
        <h2>最近签到</h2>
      </div>
      {state.recent.length === 0 ? (
        <p className="empty">还没有签到记录。</p>
      ) : (
        <ul className="ledger">
          {state.recent.map((item) => (
            <li key={item.day}>
              <span>
                {shortDay(item.day)} · 连续 {item.streak} 天
              </span>
              <span className="plus">+{item.coins}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
