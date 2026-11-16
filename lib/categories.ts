export const CATEGORIES = [
  { slug: "suspense", name: "悬疑", blurb: "线索、误导，和最后才说得通的那一下。" },
  { slug: "history", name: "历史", blurb: "朝堂、市井，和卡在时代缝里的人。" },
  { slug: "disaster", name: "灾难", blurb: "时间被掐短以后，人会先保什么。" },
  { slug: "transmigration", name: "穿越", blurb: "人到了不该到的年份，还得把日子过下去。" },
  { slug: "romance", name: "言情", blurb: "关系里的停顿、误会和靠近。" },
  { slug: "scifi", name: "科幻", blurb: "技术往前走一步之后，人还剩下什么。" },
  { slug: "urban", name: "都市", blurb: "此刻的城市，和城市里还醒着的人。" },
  { slug: "wuxia", name: "武侠", blurb: "江湖有规矩，剑只有一把。" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export function categoryName(slug: string) {
  return CATEGORIES.find((item) => item.slug === slug)?.name ?? slug;
}

export function categoryBlurb(slug: string) {
  return CATEGORIES.find((item) => item.slug === slug)?.blurb ?? "";
}

export function isCategory(slug: string): slug is CategorySlug {
  return CATEGORIES.some((item) => item.slug === slug);
}
