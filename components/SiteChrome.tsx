"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type ChromeUser = { username: string; coins: number } | null;

export function SiteChrome({ user, children }: { user: ChromeUser; children: ReactNode }) {
  const path = usePathname();
  const scripts = path.startsWith("/browse") || path.startsWith("/works") || path.startsWith("/category");
  const ranks = path.startsWith("/hot");
  const community = path.startsWith("/community");
  const upload = path.startsWith("/upload");
  const mine =
    path.startsWith("/mine") ||
    path.startsWith("/wallet") ||
    path.startsWith("/invite") ||
    path.startsWith("/checkin");
  const uploadHref = user ? "/upload" : "/login?next=/upload";
  const mineHref = user ? "/mine" : "/login?next=/mine";

  return (
    <div className="app">
      <a className="skip" href="#main">
        跳到正文
      </a>
      <header className="topbar">
        <a className="logo" href="/">
          <img className="logo-seal" src="/logo-mark.svg" width={32} height={32} alt="" />
          <span className="logo-name">
            <strong>大黄书</strong>
            <small>短剧剧本</small>
          </span>
        </a>
        <form className="desk-search" action="/browse">
          <input name="q" placeholder="搜索短剧" aria-label="搜索短剧" />
        </form>
        <nav className="desk-nav" aria-label="目录">
          <a href="/browse" aria-current={scripts ? "page" : undefined}>
            短剧
          </a>
          <a href="/hot" aria-current={ranks ? "page" : undefined}>
            榜单
          </a>
          <a href="/community" aria-current={community ? "page" : undefined}>
            社区
          </a>
          <a href={uploadHref} aria-current={upload ? "page" : undefined}>
            投稿
          </a>
          <a href={mineHref} aria-current={mine ? "page" : undefined}>
            我的
          </a>
        </nav>
        <div className="head-actions">
          <a className="icon-link mobile-search" href="/browse">
            搜索
          </a>
          {user ? (
            <a className="coin-pill" href="/wallet" aria-label={`金币 ${user.coins}，去充值`}>
              <span className="dot" />
              {user.coins}
            </a>
          ) : (
            <span className="text-btn auth-combo">
              <a href="/login" aria-current={path.startsWith("/login") ? "page" : undefined}>
                登录
              </a>
              <span className="auth-split" aria-hidden>
                /
              </span>
              <a href="/register" aria-current={path.startsWith("/register") ? "page" : undefined}>
                注册
              </a>
            </span>
          )}
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="foot">大黄书 · 短剧剧本 · 同一套账号</footer>
      <nav className="tabbar" aria-label="底部导航">
        <a className="tab" href="/browse" aria-current={scripts ? "page" : undefined}>
          短剧
        </a>
        <a className="tab" href="/hot" aria-current={ranks ? "page" : undefined}>
          榜单
        </a>
        <a className="tab" href="/community" aria-current={community ? "page" : undefined}>
          社区
        </a>
        <a className="tab" href={mineHref} aria-current={mine ? "page" : undefined}>
          我的
        </a>
      </nav>
    </div>
  );
}
