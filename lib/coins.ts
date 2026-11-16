export const SIGNUP_COINS = 20;
export const INVITER_COINS = 15;
export const INVITEE_COINS = 10;

/** Consecutive-day rewards. Day 7 and after stay on the last amount. */
export const CHECKIN_REWARDS = [2, 3, 4, 5, 6, 8, 10] as const;

export function checkinReward(streak: number) {
  const index = Math.min(Math.max(streak, 1), CHECKIN_REWARDS.length) - 1;
  return CHECKIN_REWARDS[index];
}

export const PACKS = [
  { id: "coin30", coins: 30, yuan: 6, label: "试读" },
  { id: "coin98", coins: 98, yuan: 18, label: "常用" },
  { id: "coin328", coins: 328, yuan: 50, label: "整季" },
] as const;

export type PackId = (typeof PACKS)[number]["id"];

export function findPack(id: string) {
  return PACKS.find((pack) => pack.id === id);
}
