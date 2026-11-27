import { describe, expect, it } from "vitest";

import { bookBlocks, extractBookPlate, halveBlock, packByHeight } from "@/lib/book";

describe("book pages", () => {
  it("lifts the first safe image out of the prose", () => {
    const plate = extractBookPlate("窗前\n\n![雪](https://example.com/snow.png)\n\n她没有点灯。");
    expect(plate.image).toBe("https://example.com/snow.png");
    expect(plate.markdown).toContain("窗前");
    expect(plate.markdown).toContain("她没有点灯。");
    expect(plate.markdown).not.toContain("![雪]");
  });

  it("drops unsafe images and keeps the prose", () => {
    const plate = extractBookPlate("开头\n\n![x](javascript:alert(1))\n\n结尾");
    expect(plate.image).toBeNull();
    expect(plate.markdown).toBe("开头\n\n结尾");
  });

  it("splits blank lines into blocks and packs them by height", () => {
    expect(bookBlocks("甲\n\n乙\n\n\n丙")).toEqual(["甲", "乙", "丙"]);
    expect(packByHeight([10, 10, 10], 25)).toEqual([
      [0, 1],
      [2],
    ]);
    expect(packByHeight([40], 25)).toEqual([[0]]);
    expect(packByHeight([], 25)).toEqual([[]]);
  });

  it("halves a long paragraph on a sentence boundary", () => {
    const halves = halveBlock("夜色压在窗纸上，她把灯芯挑高了一点。门外的雪还在下，屋里只剩这一盏灯。");
    expect(halves?.[0].endsWith("。")).toBe(true);
    expect(halves?.[1].length).toBeGreaterThan(8);
    expect(halveBlock("太短。")).toBeNull();
  });
});
