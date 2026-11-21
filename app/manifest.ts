import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "大黄书剧本小说网",
    short_name: "大黄书",
    description: "大黄书剧本小说网。短剧剧本与小说，分类阅读，投稿审核，金币解锁。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fff6e4",
    theme_color: "#fff6e4",
    lang: "zh-CN",
    orientation: "any",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
