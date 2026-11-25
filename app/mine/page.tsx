import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { logoutAction } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { categoryName } from "@/lib/categories";
import { CHECKIN_REWARDS, INVITER_COINS } from "@/lib/coins";
import { getCheckinState, listByAuthor, listRequirementsByUser, listUnlocked } from "@/lib/db";
import { priceLabel } from "@/lib/format";
import { coinLabel } from "@/lib/pricing";
import { requirementStatusLabel } from "@/lib/requirements";

export const metadata: Metadata = { title: "我的" };

export default async function MinePage({ searchParams }: { searchParams: Promise<{ activated?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/mine");
  const params = await searchParams;
  const mine = listByAuthor(user.id);
  const unlocked = listUnlocked(user.id);
  const requirements = listRequirementsByUser(user.id);
  const checkin = getCheckinState(user.id);
  const checkinHint = checkin.checkedIn
    ? `已连续 ${checkin.streak} 天`
    : `今日可领 ${checkin.reward} 金币`;
  const maxCheckin = CHECKIN_REWARDS[CHECKIN_REWARDS.length - 1];

  return (
    <div className="wrap page mine-page">
      <div className="mine-profile">
        <div className="mine-avatar" aria-hidden>
          {user.username.slice(0, 1).toUpperCase()}
        </div>
        <div className="mine-profile-text">
          <p className="kicker">我的</p>
          <h1>{user.username}</h1>
        </div>
        <form action={logoutAction}>
          <button className="btn ghost mine-logout" type="submit">
            退出
          </button>
        </form>
      </div>

      {params.activated === "1" ? <p className="note">邮箱已激活，金币已入账。</p> : null}

      <section className="gold-wallet" aria-label="金币">
        <div className="gold-wallet-main">
          <span className="hint">当前金币</span>
          <p className="balance">
            {user.coins}
            <small>金</small>
          </p>
          <p className="gold-tip">1 元 = 10 金币 · 充值即时到账</p>
        </div>
        <a className="btn solid gold-wallet-cta" href="/wallet">
          去充值
        </a>
      </section>

      <nav className="mine-menu" aria-label="常用功能">
        <a className="mine-menu-row" href="/wallet">
          <span className="mine-menu-ico" aria-hidden>
            金
          </span>
          <span className="mine-menu-body">
            <strong>金币充值</strong>
            <small>解锁 / 买断 / 征稿都扣金币</small>
          </span>
          <span className="mine-menu-meta">{user.coins} 金</span>
          <span className="mine-menu-chev" aria-hidden>
            ›
          </span>
        </a>
        <a className="mine-menu-row" href="/checkin">
          <span className="mine-menu-ico checkin" aria-hidden>
            签
          </span>
          <span className="mine-menu-body">
            <strong>每日签到领 {maxCheckin} 金币</strong>
            <small>{checkinHint}</small>
          </span>
          <span className={`mine-menu-meta${checkin.checkedIn ? " done" : ""}`}>
            {checkin.checkedIn ? "已签" : "去签"}
          </span>
          <span className="mine-menu-chev" aria-hidden>
            ›
          </span>
        </a>
        <a className="mine-menu-row" href="/invite">
          <span className="mine-menu-ico invite" aria-hidden>
            邀
          </span>
          <span className="mine-menu-body">
            <strong>邀请好友</strong>
            <small>好友激活后你得 {INVITER_COINS} 金币</small>
          </span>
          <span className="mine-menu-meta">+{INVITER_COINS}</span>
          <span className="mine-menu-chev" aria-hidden>
            ›
          </span>
        </a>
        <a className="mine-menu-row" href="/upload">
          <span className="mine-menu-ico upload" aria-hidden>
            投
          </span>
          <span className="mine-menu-body">
            <strong>投稿短剧</strong>
            <small>上架后可售卖与买断</small>
          </span>
          <span className="mine-menu-chev" aria-hidden>
            ›
          </span>
        </a>
        <a className="mine-menu-row" href="/requirements/new">
          <span className="mine-menu-ico req" aria-hidden>
            征
          </span>
          <span className="mine-menu-body">
            <strong>发布征稿</strong>
            <small>赏金用金币支付，最低 1000 金</small>
          </span>
          <span className="mine-menu-chev" aria-hidden>
            ›
          </span>
        </a>
      </nav>

      <p className="hint mine-install">用手机浏览器打开后，选「添加到主屏幕」，会像一个应用一样全屏打开。</p>

      <div className="section-title">
        <h2>我的征稿</h2>
        <a href="/requirements/new">发布</a>
      </div>
      {requirements.length === 0 ? (
        <p className="empty">
          还没有定制需求。<a href="/requirements/new">去发布征稿</a>
        </p>
      ) : (
        <div className="list">
          {requirements.map((item) => (
            <a className="line" key={item.id} href={`/requirements/${item.id}`}>
              <span>
                <strong>{item.title}</strong>
                <br />
                <span className="hint">
                  {coinLabel(item.bounty_yuan)}
                  {item.delivered_work_id ? " · 已交付" : ""}
                </span>
              </span>
              <span className={`pill${item.status === "delivered" ? " ok" : item.status === "awaiting_pay" ? " bad" : ""}`}>
                {requirementStatusLabel(item.status)}
              </span>
            </a>
          ))}
        </div>
      )}

      <div className="section-title">
        <h2>我的投稿</h2>
        <a href="/upload">投稿</a>
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
              <span className="hint">
                {priceLabel(work.price)}
                {work.price > 0 ? " · 可免费下载" : ""}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
