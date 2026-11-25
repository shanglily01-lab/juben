import { describe, expect, it } from "vitest";

import {
  BUYOUT_YUAN,
  PAY_CHANNELS,
  UNLOCK_YUAN_STEPS,
  episodeBand,
  isPayChannel,
  qualityBand,
  tierForScore,
  unlockYuanFromScore,
  yuanLabel,
} from "@/lib/pricing";

describe("pricing", () => {
  it("exposes unlock steps including 20 / 30 / 50 / 80", () => {
    expect([...UNLOCK_YUAN_STEPS]).toEqual([20, 30, 50, 80, 100, 200, 300]);
  });

  it("maps episode + quality to yuan", () => {
    // 1 集 × 乙 → 20；1 集 × 甲上 → 80
    expect(unlockYuanFromScore(6, 1)).toBe(20);
    expect(unlockYuanFromScore(9.2, 1)).toBe(80);
    // 2–5 集 × 甲 → 80；6–15 × 乙上 → 80；16+ × 甲上 → 300
    expect(unlockYuanFromScore(8, 3)).toBe(80);
    expect(unlockYuanFromScore(7.2, 10)).toBe(80);
    expect(unlockYuanFromScore(9, 20)).toBe(300);
    // 兼容旧调用：缺集数按 1 集
    expect(unlockYuanFromScore(8)).toBe(50);
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

  it("exposes per-work buyout and labels", () => {
    expect(BUYOUT_YUAN).toBe(500);
    expect(yuanLabel(80)).toBe("¥80");
    expect(tierForScore(8.5).minScore).toBe(8);
  });

  it("hardcodes WeChat 005 and Alipay 004", () => {
    expect(PAY_CHANNELS.map((c) => c.id)).toEqual(["005", "004"]);
    expect(isPayChannel("005")).toBe(true);
    expect(isPayChannel("004")).toBe(true);
    expect(isPayChannel("P0000")).toBe(false);
  });
});
