import { describe, expect, it } from "vitest";

import { promptFor, renderCoverSvg } from "@/lib/cover";

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

  it("封面提示按主剧情组织，并禁止画面上的文字", () => {
    const prompt = promptFor({
      id: 1,
      title: "末班夜车",
      summary: "暴雪夜，末班车上只剩两个人。",
      category: "suspense",
      kind: "script",
      grade: "甲",
      content: "车门关上。她发现对面座位的男人手里握着一把钥匙。",
    });
    expect(prompt).toContain("no text");
    expect(prompt).toContain("暴雪夜");
    expect(prompt).toContain("钥匙");
  });
});
