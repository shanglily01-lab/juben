import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CheckinForm } from "@/components/CheckinForm";
import { getCurrentUser } from "@/lib/auth";
import { CHECKIN_REWARDS } from "@/lib/coins";
import { getCheckinState } from "@/lib/db";
import { shortDay } from "@/lib/format";

export const metadata: Metadata = { title: "签到" };

export default async function CheckinPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/checkin");
  const params = await searchParams;
  const state = getCheckinState(user.id);
  const activeIndex = Math.min(state.streak, CHECKIN_REWARDS.length) - 1;

  return (
    <div className="wrap page">
      <p className="kicker">签到</p>
      <h1>{state.checkedIn ? `连续 ${state.streak} 天` : "今天还没签"}</h1>
      <p className="intro">
        {state.checkedIn
          ? `今日已入账 ${state.reward} 金币。连续签到到第 7 天后，每天 ${CHECKIN_REWARDS[CHECKIN_REWARDS.length - 1]} 金币。断一天就从 2 重新开始。`
          : `现在签到是连续第 ${state.streak} 天，可以领取 ${state.reward} 金币。一天按北京时间计算。`}
      </p>
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
