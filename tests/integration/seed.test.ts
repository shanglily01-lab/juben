import { readSeedWorks } from "@/lib/seed";
import { previewMarkdown } from "@/lib/format";
import { reviewLocal } from "@/lib/ai";
import { describe, expect, it } from "vitest";

describe("编辑室稿件", () => {
  it("每篇都能过审，付费预览不会带上结尾", () => {
    const works = readSeedWorks();
    expect(works.length).toBeGreaterThanOrEqual(5);
    expect(works.every((work) => work.kind === "script")).toBe(true);
    for (const work of works) {
      const review = reviewLocal(work);
      expect(review.decision, work.title).toBe("approve");
      const tail = work.content.replace(/\s+/g, "").slice(-24);
      const leaked = work.price > 0 && previewMarkdown(work.content).replace(/\s+/g, "").includes(tail);
      expect(leaked, work.title).toBe(false);
    }
  });
});
