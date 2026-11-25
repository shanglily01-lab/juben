import { describe, expect, it } from "vitest";

import { renderCoverSvg } from "@/lib/cover";

describe("剧情封面", () => {
  it("把标题和简介画进海报，并转义标记", () => {
    const svg = renderCoverSvg({
      title: "末班夜车<雪>",
      summary: "末班车只剩雪，和一节空车厢。",
      category: "suspense",
      kind: "script",
      grade: "甲",
    });
    expect(svg.startsWith("<?xml")).toBe(true);
    expect(svg).toContain("<title>末班夜车&lt;雪&gt;</title>");
    expect(svg).toContain("末班车只剩雪");
    expect(svg).not.toContain("<script");
  });
});
