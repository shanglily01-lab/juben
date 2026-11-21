import type { Metadata, Viewport } from "next";

import { PwaRegister } from "@/components/PwaRegister";
import { SiteChrome } from "@/components/SiteChrome";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "大黄书剧本小说网", template: "%s · 大黄书剧本小说网" },
  description: "大黄书剧本小说网。短剧剧本与小说放在一起，按分类阅读，投稿后自动审核评级，用金币解锁付费篇目。",
  applicationName: "大黄书剧本小说网",
  appleWebApp: { capable: true, title: "大黄书", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fff6e4",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="zh-CN">
      <body>
        <SiteChrome user={user ? { username: user.username, coins: user.coins } : null}>{children}</SiteChrome>
        <PwaRegister />
      </body>
    </html>
  );
}
