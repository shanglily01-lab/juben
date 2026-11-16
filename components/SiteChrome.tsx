"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type ChromeUser = { username: string; coins: number } | null;

export function SiteChrome({ user, children }: { user: ChromeUser; children: ReactNode }) {
  const path = usePathname();
  const library = path.startsWith("/browse") || path.startsWith("/works") || path.startsWith("/category");
  const upload = path.startsWith("/upload");
  const mine =
    path.startsWith("/mine") ||
    path.startsWith("/wallet") ||
    path.startsWith("/checkin") ||
    path.startsWith("/invite");
  const uploadHref = user ? "/upload" : "/login?next=/upload";
  const mineHref = user ? "/mine" : "/login?next=/mine";

  return (
    <div className="app">
      <a className="skip" href="#main">
        跳到正文
      </a>
      <header className="topbar">
        <a className="logo" href="/">
          墨本
        </a>
        <nav className="desk-nav" aria-label="目录">
          <a href="/browse" aria-current={library ? "page" : undefined}>
            书库
          </a>
          <a href="/browse?kind=script">短剧</a>
          <a href="/browse?kind=novel">小说</a>
          <a href={user ? "/checkin" : "/login?next=/checkin"} aria-current={path.startsWith("/checkin") ? "page" : undefined}>
            签到
          </a>
          <a href={uploadHref} aria-current={upload ? "page" : undefined}>
            投稿
          </a>
        </nav>
        <form className="desk-search" action="/browse">
          <input name="q" placeholder="搜索" aria-label="搜索剧本或小说" />
        </form>
        <div className="head-actions">
          <a className="icon-link mobile-search" href="/browse">
            搜索
          </a>
          {user ? (
            <a className="coin-pill" href="/wallet" aria-label={`${user.coins} 金币`}>
              <span className="dot" />
              {user.coins}
            </a>
          ) : (
            <a className="text-btn" href="/login">
              登录
            </a>
          )}
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="foot">墨本 · 短剧剧本与小说 · 同一套账号和金币</footer>
      <nav className="tabbar" aria-label="底部导航">
        <a className="tab" href="/" aria-current={path === "/" ? "page" : undefined}>
          首页
        </a>
        <a className="tab" href="/browse" aria-current={library ? "page" : undefined}>
          书库
        </a>
        <a className="tab" href={uploadHref} aria-current={upload ? "page" : undefined}>
          投稿
        </a>
        <a className="tab" href={mineHref} aria-current={mine ? "page" : undefined}>
          我的
        </a>
      </nav>
    </div>
  );
}
