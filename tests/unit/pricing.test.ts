import { describe, expect, it } from "vitest";

import {
  BUYOUT_COINS,
  BUYOUT_YUAN,
  COIN_PER_YUAN,
  MIN_REQUIREMENT_COINS,
  PAY_CHANNELS,
  UNLOCK_YUAN_STEPS,
  coinLabel,
  episodeBand,
  isPayChannel,
  qualityBand,
  tierForScore,
  unlockCoinsFromScore,
  unlockYuanFromScore,
  yuanLabel,
} from "@/lib/pricing";

describe("pricing", () => {
  it("uses 1 yuan = 10 coins", () => {
    expect(COIN_PER_YUAN).toBe(10);
    expect(BUYOUT_COINS).toBe(BUYOUT_YUAN * 10);
    expect(MIN_REQUIREMENT_COINS).toBe(1000);
  });

  it("exposes unlock steps including 20 / 30 / 50 / 80", () => {
    expect([...UNLOCK_YUAN_STEPS]).toEqual([20, 30, 50, 80, 100, 200, 300]);
  });

  it("maps episode + quality to yuan and coins", () => {
    expect(unlockYuanFromScore(6, 1)).toBe(20);
    expect(unlockCoinsFromScore(6, 1)).toBe(200);
    expect(unlockYuanFromScore(9.2, 1)).toBe(80);
    expect(unlockCoinsFromScore(9.2, 1)).toBe(800);
    expect(unlockYuanFromScore(8, 3)).toBe(80);
    expect(unlockYuanFromScore(9, 20)).toBe(300);
    expect(unlockCoinsFromScore(9, 20)).toBe(3000);
  });

  it("bands episode and quality", () => {
    expect(episodeBand(1)).toBe(0);
    expect(episodeBand(5)).toBe(1);
    expect(episodeBand(15)).toBe(2);
    expect(episodeBand(16)).toBe(3);
    expect(qualityBand(6.5)).toBe(0);
    expect(qualityBand(7)).toBe(1);
    expect(qualityBand(8)).toBe(2);
    expect(qualityBand(9)).toBe(3);
  });

  it("labels coins and yuan", () => {
    expect(yuanLabel(80)).toBe("¥80");
    expect(coinLabel(800)).toBe("800 金");
    expect(tierForScore(8.5).minScore).toBe(8);
  });

  it("hardcodes WeChat 005 and Alipay 004", () => {
    expect(PAY_CHANNELS.map((c) => c.id)).toEqual(["005", "004"]);
    expect(isPayChannel("005")).toBe(true);
    expect(isPayChannel("004")).toBe(true);
    expect(isPayChannel("P0000")).toBe(false);
  });
});
