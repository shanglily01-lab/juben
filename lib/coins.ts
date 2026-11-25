export const SIGNUP_COINS = 20;
export const INVITER_COINS = 15;
export const INVITEE_COINS = 10;

/** Consecutive-day rewards. Day 7 and after stay on the last amount. */
export const CHECKIN_REWARDS = [2, 3, 4, 5, 6, 8, 10] as const;

export function checkinReward(streak: number) {
  const index = Math.min(Math.max(streak, 1), CHECKIN_REWARDS.length) - 1;
  return CHECKIN_REWARDS[index];
}

/** 真充值档：1 元 = 10 金。 */
export const PACKS = [
  { id: "coin60", coins: 60, yuan: 6, label: "试读" },
  { id: "coin180", coins: 180, yuan: 18, label: "常用" },
  { id: "coin500", coins: 500, yuan: 50, label: "整季" },
  { id: "coin1000", coins: 1000, yuan: 100, label: "征稿起步" },
] as const;

export type PackId = (typeof PACKS)[number]["id"];

export function findPack(id: string) {
  return PACKS.find((pack) => pack.id === id);
}
