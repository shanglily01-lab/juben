import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { logoutAction } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { categoryName } from "@/lib/categories";
import { INVITER_COINS } from "@/lib/coins";
import { getCheckinState, listByAuthor, listUnlocked } from "@/lib/db";
import { priceLabel } from "@/lib/format";

export const metadata: Metadata = { title: "我的" };

export default async function MinePage({ searchParams }: { searchParams: Promise<{ activated?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/mine");
  const params = await searchParams;
  const mine = listByAuthor(user.id);
  const unlocked = listUnlocked(user.id);
  const checkin = getCheckinState(user.id);

  return (
    <div className="wrap page">
      <div className="mine-head">
        <div>
          <p className="kicker">我的</p>
          <h1>{user.username}</h1>
        </div>
        <form action={logoutAction}>
          <button className="btn ghost" type="submit">
            退出
          </button>
        </form>
      </div>
      {params.activated === "1" ? <p className="note">邮箱已激活，金币已入账。</p> : null}
      <a className="panel checkin-card" href="/checkin">
        <span className="hint">{checkin.checkedIn ? "今日已签" : "今日未签"}</span>
        <p className="balance">
          {checkin.checkedIn ? `连续 ${checkin.streak} 天` : `+${checkin.reward}`}
          <small>{checkin.checkedIn ? "明天继续" : "去签到"}</small>
        </p>
      </a>
      <div className="pair">
        <a className="panel" href="/wallet">
          <span className="hint">金币余额，短剧和小说通用</span>
          <p className="balance">
            {user.coins}
            <small>金币</small>
          </p>
        </a>
        <a className="panel" href="/invite">
          <span className="hint">邀请好友注册</span>
          <p className="balance">
            {INVITER_COINS}
            <small>金币 / 人</small>
          </p>
        </a>
      </div>
      <p className="hint">用手机浏览器打开后，选「添加到主屏幕」，会像一个应用一样全屏打开。</p>

      <div className="section-title">
        <h2>我的投稿</h2>
      </div>
      {mine.length === 0 ? (
        <p className="empty">
          还没有稿。<a href="/upload">去投稿</a>
        </p>
      ) : (
        <div className="list">
          {mine.map((work) => (
            <a className="line" key={work.id} href={`/works/${work.id}`}>
              <span>
                <strong>{work.title}</strong>
                <br />
                <span className="hint">
                  {categoryName(work.category)} · {priceLabel(work.price)} · {work.grade}
                </span>
              </span>
              <span className={work.status === "published" ? "pill ok" : "pill bad"}>
                {work.status === "published" ? "已上架" : "未过审"}
              </span>
            </a>
          ))}
        </div>
      )}

      <div className="section-title">
        <h2>已解锁</h2>
      </div>
      {unlocked.length === 0 ? (
        <p className="empty">还没有解锁过付费篇。书库里的免费稿可以先读。</p>
      ) : (
        <div className="list">
          {unlocked.map((work) => (
            <a className="line" key={work.id} href={`/works/${work.id}`}>
              <span>{work.title}</span>
              <span className="hint">{priceLabel(work.price)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
