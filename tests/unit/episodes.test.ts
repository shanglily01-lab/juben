import { describe, expect, it } from "vitest";

import { clampEpisode, splitEpisodes } from "@/lib/episodes";

describe("episodes", () => {
  it("keeps whole text as one episode without headings", () => {
    const list = splitEpisodes("只有一段，没有标题。");
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("全文");
  });

  it("splits on ## headings", () => {
    const list = splitEpisodes("序\n\n## 第一场\n\n甲\n\n## 第二场\n\n乙");
    expect(list.map((item) => item.title)).toEqual(["开篇", "第一场", "第二场"]);
    expect(list[1].body).toContain("## 第一场");
    expect(list[2].body).toContain("乙");
  });

  it("clamps episode index", () => {
    expect(clampEpisode(0, 3)).toBe(1);
    expect(clampEpisode(9, 3)).toBe(3);
    expect(clampEpisode(2.8, 3)).toBe(2);
  });
});
