import type { Metadata, Viewport } from "next";

import { PwaRegister } from "@/components/PwaRegister";
import { SiteChrome } from "@/components/SiteChrome";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "墨本", template: "%s · 墨本" },
  description: "短剧剧本与小说。按悬疑、历史、灾难、穿越等分类阅读，投稿后自动审核评级，用金币解锁付费篇目。",
  applicationName: "墨本",
  appleWebApp: { capable: true, title: "墨本", statusBarStyle: "black-translucent" },
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
  themeColor: "#1a1410",
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
