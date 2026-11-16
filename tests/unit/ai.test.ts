import { afterEach, describe, expect, it, vi } from "vitest";

import { reviewLocal, reviewWork } from "@/lib/ai";
import { countWords } from "@/lib/format";
import { readSeedWorks } from "@/lib/seed";

function scriptBody() {
  const lines = [
    "第一场 站台",
    "人物：她、他",
    "△ 雨夜的站台只剩下一盏灯。",
    "她：这班车为什么多出一站？",
    "他：有人把终点改在了这里。",
    "她：那张旧票是谁留下的？",
    "他：是还没下车的那个人。",
  ];
  const words = ["夜色", "雨丝", "灯牌", "月台", "旧票", "终点", "回声", "站名", "手套", "时刻表"];
  let text = lines.join("\n");
  let index = 0;
  while (countWords(text) < 450) {
    const left = words[index % words.length];
    const right = words[(index * 3 + 1) % words.length];
    text += `${left}停在${right}旁边，第${index}个人没有上车。`;
    index += 1;
  }
  return text;
}

const sample = {
  title: "末班",
  kind: "script" as const,
  category: "suspense",
  summary: "末班车多了一站",
  content: scriptBody(),
};

afterEach(() => {
  delete process.env.AI_API_KEY;
  vi.unstubAllGlobals();
});

describe("本地审核", () => {
  it("篇幅和句子都够的短剧可以通过", () => {
    const work = readSeedWorks().find((item) => item.kind === "script");
    expect(work).toBeTruthy();
    if (!work) return;
    const review = reviewLocal(work);
    expect(review.decision).toBe("approve");
    expect(review.score).toBeGreaterThanOrEqual(6);
    expect(review.grade).not.toBe("未过");
    expect(review.source).toBe("local");
    expect(countWords(work.content)).toBeGreaterThanOrEqual(400);
  });

  it("太短或不成句的稿直接压到未过", () => {
    const review = reviewLocal({ ...sample, content: "太短了。只有一句。" });
    expect(review.decision).toBe("reject");
    expect(review.score).toBeLessThanOrEqual(5.4);
    expect(review.grade).toBe("未过");
    expect(review.advice.join("")).toContain("篇幅不够");
  });

  it("没有模型密钥时走本地审核", async () => {
    delete process.env.AI_API_KEY;
    const review = await reviewWork(sample);
    expect(review.source).toBe("local");
  });

  it("模型返回的 JSON 会被收成审核结果，坏响应退回本地", async () => {
    process.env.AI_API_KEY = "test-key";
    process.env.AI_BASE_URL = "https://model.test/v1";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          choices: [
            {
              message: {
                content:
                  '```json\n{"score":15,"decision":"approve","summary":"能上架","advice":["再收一点"],"dimensions":{"plot":9,"character":9,"pacing":9,"language":9,"completeness":9}}\n```',
              },
            },
          ],
        }),
      ),
    );
    const approved = await reviewWork(sample);
    expect(approved.source).toBe("model");
    expect(approved.score).toBe(10);
    expect(approved.decision).toBe("approve");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          choices: [{ message: { content: '{"score":9,"decision":"reject","summary":"退回","advice":[],"dimensions":{"plot":9,"character":9,"pacing":9,"language":9,"completeness":9}}' } }],
        }),
      ),
    );
    const rejected = await reviewWork(sample);
    expect(rejected.decision).toBe("reject");
    expect(rejected.grade).toBe("未过");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    expect((await reviewWork(sample)).source).toBe("local");

    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ choices: [{ message: { content: "不是 json" } }] })));
    expect((await reviewWork(sample)).source).toBe("local");
  });
});
