/** 单篇独占买断价（人民币元）。买断后仅买断者可阅读，其他人不可再读。 */
export const BUYOUT_YUAN = 500;

/** 用户征稿赏金最低价（人民币元）。交稿后仅需求方可读。 */
export const MIN_REQUIREMENT_YUAN = 100;

/** 写死通道：005 微信，004 支付宝。 */
export const PAY_CHANNELS = [
  { id: "005", label: "微信支付", short: "微信" },
  { id: "004", label: "支付宝", short: "支付宝" },
] as const;

export type PayChannelId = (typeof PAY_CHANNELS)[number]["id"];

export function isPayChannel(value: string): value is PayChannelId {
  return PAY_CHANNELS.some((channel) => channel.id === value);
}

/** 可售价档：短篇低质起 ¥20，长篇精品到 ¥300。 */
export const UNLOCK_YUAN_STEPS = [20, 30, 50, 80, 100, 200, 300] as const;

export type UnlockYuan = (typeof UNLOCK_YUAN_STEPS)[number];

/**
 * 价目说明（展示用）。实际成交价由「集数 × 评分」矩阵决定。
 * 行：集数档；列：质量档（乙 / 乙上 / 甲 / 甲上）。
 */
export const QUALITY_TIERS = [
  { id: "a", label: "甲上 · 精品", minScore: 9, yuan: 300, hint: "结构完整、场面抓人" },
  { id: "b", label: "甲 · 优质", minScore: 8, yuan: 200, hint: "人物立得住、节奏稳" },
  { id: "c", label: "乙上 · 可读", minScore: 7, yuan: 100, hint: "节奏清楚、过审可读" },
  { id: "d", label: "乙 · 入门", minScore: 6, yuan: 50, hint: "短篇可低价试读" },
] as const;

export type QualityTierId = (typeof QUALITY_TIERS)[number]["id"];

/** [集数档][质量档] → 元。集数：1 / 2–5 / 6–15 / 16+；质量：乙 / 乙上 / 甲 / 甲上。 */
const PRICE_MATRIX: UnlockYuan[][] = [
  [20, 30, 50, 80],
  [30, 50, 80, 100],
  [50, 80, 100, 200],
  [80, 100, 200, 300],
];

export function episodeBand(episodeCount: number) {
  const n = Math.max(1, Math.floor(Number(episodeCount) || 1));
  if (n <= 1) return 0;
  if (n <= 5) return 1;
  if (n <= 15) return 2;
  return 3;
}

export function qualityBand(score: number) {
  const s = Number(score) || 0;
  if (s >= 9) return 3;
  if (s >= 8) return 2;
  if (s >= 7) return 1;
  return 0;
}

/** 已过审作品按「集数 + 评分」落到 20 / 30 / 50 / 80 / 100 / 200 / 300。 */
export function unlockYuanFromScore(score: number, episodeCount = 1): UnlockYuan {
  return PRICE_MATRIX[episodeBand(episodeCount)][qualityBand(score)];
}

export function tierForScore(score: number) {
  return QUALITY_TIERS.find((tier) => score >= tier.minScore) ?? QUALITY_TIERS[QUALITY_TIERS.length - 1];
}

export function yuanLabel(yuan: number) {
  return `¥${yuan}`;
}
