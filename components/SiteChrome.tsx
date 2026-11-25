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
    path.startsWith("/invite") ||
    path.startsWith("/requirements");
  const uploadHref = user ? "/upload" : "/login?next=/upload";
  const mineHref = user ? "/mine" : "/login?next=/mine";
  const requirementsHref = "/requirements";

  return (
    <div className="app">
      <a className="skip" href="#main">
        跳到正文
      </a>
      <header className="topbar">
        <a className="logo" href="/">
          <span className="logo-seal" aria-hidden>
            书
          </span>
          <span className="logo-name">
            <strong>大黄书</strong>
            <small>剧本小说网</small>
          </span>
        </a>
        <nav className="desk-nav" aria-label="目录">
          <a href="/browse" aria-current={library ? "page" : undefined}>
            书库
          </a>
          <a href="/hot" aria-current={path.startsWith("/hot") ? "page" : undefined}>
            榜单
          </a>
          <a href="/requirements" aria-current={path.startsWith("/requirements") ? "page" : undefined}>
            征稿
          </a>
          <a href="/community" aria-current={path.startsWith("/community") ? "page" : undefined}>
            社区
          </a>
          <a href="/browse?kind=script">短剧</a>
          <a href="/browse?kind=novel">小说</a>
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
      <footer className="foot">大黄书剧本小说网 · 短剧剧本与小说 · 同一套账号和金币</footer>
      <nav className="tabbar" aria-label="底部导航">
        <a className="tab" href="/" aria-current={path === "/" ? "page" : undefined}>
          首页
        </a>
        <a className="tab" href="/browse" aria-current={library ? "page" : undefined}>
          书库
        </a>
        <a className="tab" href={requirementsHref} aria-current={path.startsWith("/requirements") ? "page" : undefined}>
          征稿
        </a>
        <a className="tab" href={mineHref} aria-current={mine && !path.startsWith("/requirements") ? "page" : undefined}>
          我的
        </a>
      </nav>
    </div>
  );
}
