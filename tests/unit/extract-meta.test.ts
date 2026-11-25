import { describe, expect, it } from "vitest";

import { extractMetaLocal } from "@/lib/extract-meta";

describe("投稿元数据识别", () => {
  it("从 Markdown 标题和正文抽出标题简介分类", () => {
    const meta = extractMetaLocal(`# 雪夜末班车

第一场 地铁车厢

△暴雪。末班车只剩两个人。她发现对面男人手里握着一把钥匙，像是开过凶案现场的门。

男：你也是去终点站吗？
女：……我只是想回家。
`);
    expect(meta.title).toContain("雪夜末班车");
    expect(meta.summary.length).toBeGreaterThanOrEqual(10);
    expect(meta.kind).toBe("script");
    expect(["suspense", "urban", "disaster"]).toContain(meta.category);
  });

  it("武侠关键词会倾向武侠分类", () => {
    const meta = extractMetaLocal(`# 青锋门恩怨

江湖里只剩一把青锋剑。掌门死的那天夜里，门派规矩被撕碎了。
侠客提剑入城，要问一句：谁敢改门规。
`);
    expect(meta.category).toBe("wuxia");
  });
});
