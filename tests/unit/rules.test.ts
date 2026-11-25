import { describe, expect, it } from "vitest";

import { categoryBlurb, categoryName, isCategory } from "@/lib/categories";
import { CHECKIN_REWARDS, SIGNUP_COINS, checkinReward, findPack } from "@/lib/coins";
import { makeInviteCode, normalizeInviteCode } from "@/lib/codes";
import {
  browseHref,
  countWords,
  formatDate,
  gradeOf,
  parseReview,
  previewMarkdown,
  previousDay,
  priceLabel,
  safeMarkdownUrl,
  safeNext,
  shanghaiToday,
  formatReads,
  shelfPriceLabel,
  shortDay,
} from "@/lib/format";
import { hashPassword, verifyPassword } from "@/lib/password";
import { dataDir } from "@/lib/paths";

describe("分类", () => {
  it("认识八个分类，不认识的原样返回", () => {
    expect(isCategory("suspense")).toBe(true);
    expect(isCategory("mystery")).toBe(false);
    expect(categoryName("history")).toBe("历史");
    expect(categoryName("nope")).toBe("nope");
    expect(categoryBlurb("wuxia")).toContain("江湖");
  });
});

describe("金币规则", () => {
  it("连续签到按阶梯发，第 7 天以后保持 10", () => {
    expect(checkinReward(1)).toBe(2);
    expect(CHECKIN_REWARDS.map((_, index) => checkinReward(index + 1))).toEqual([2, 3, 4, 5, 6, 8, 10]);
    expect(checkinReward(8)).toBe(10);
    expect(checkinReward(0)).toBe(2);
  });

  it("只认识三档演示充值", () => {
    expect(findPack("coin30")).toMatchObject({ coins: 30, yuan: 6 });
    expect(findPack("coin98")?.coins).toBe(98);
    expect(findPack("nope")).toBeUndefined();
    expect(SIGNUP_COINS).toBe(20);
  });
});

describe("邀请码", () => {
  it("空字符串表示没填，格式不对返回 null", () => {
    expect(normalizeInviteCode("  ")).toBe("");
    expect(normalizeInviteCode("ab")).toBeNull();
    expect(normalizeInviteCode("你好世界")).toBeNull();
    expect(normalizeInviteCode("abc-12")).toBeNull();
    expect(normalizeInviteCode(" abc123 ")).toBe("ABC123");
  });

  it("生成的码固定 8 位，并且避开容易看混的字符", () => {
    for (let index = 0; index < 20; index += 1) {
      const code = makeInviteCode();
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    }
  });
});

describe("格式", () => {
  it("按北京时间取日期，并能退到上一个月和上一年", () => {
    expect(shanghaiToday(new Date("2026-11-16T16:30:00Z"))).toBe("2026-11-17");
    expect(shanghaiToday(new Date("2026-11-16T15:59:00Z"))).toBe("2026-11-16");
    expect(previousDay("2026-03-01")).toBe("2026-02-28");
    expect(previousDay("2026-01-01")).toBe("2025-12-31");
    expect(shortDay("2026-11-07")).toBe("11/7");
  });

  it("字数按汉字加西文单词计算", () => {
    expect(countWords("hello 世界")).toBe(3);
    expect(countWords("")).toBe(0);
  });

  it("评级和价格文案", () => {
    expect(gradeOf(9)).toBe("甲上");
    expect(gradeOf(8)).toBe("甲");
    expect(gradeOf(7)).toBe("乙上");
    expect(gradeOf(6)).toBe("乙");
    expect(gradeOf(5.9)).toBe("未过");
    expect(priceLabel(0)).toBe("免费");
    expect(priceLabel(12)).toBe("12 金币");
    expect(shelfPriceLabel(0, 9)).toBe("免费");
    expect(shelfPriceLabel(10, 9.1, 1)).toBe("¥80");
    expect(shelfPriceLabel(10, 8, 3)).toBe("¥80");
    expect(shelfPriceLabel(10, 6.5, 1)).toBe("¥20");
    expect(shelfPriceLabel(10, 9, 20)).toBe("¥300");
    expect(formatReads(12)).toBe("12 阅读");
    expect(formatReads(12000)).toBe("1.2万阅读");
  });

  it("预览停在句号或段落，短文原样返回", () => {
    expect(previewMarkdown("很短。")).toBe("很短。");
    const long = `${"甲".repeat(100)}。\n\n${"乙".repeat(400)}`;
    const preview = previewMarkdown(long);
    expect(preview.endsWith("。")).toBe(true);
    expect(preview.includes("乙")).toBe(false);
    expect(previewMarkdown("丙".repeat(400)).endsWith("……")).toBe(true);
  });

  it("跳转地址只接受站内路径", () => {
    expect(safeNext("/mine", "/")).toBe("/mine");
    expect(safeNext("", "/mine")).toBe("/mine");
    expect(safeNext("//evil.test", "/")).toBe("/");
    expect(safeNext("https://evil.test", "/")).toBe("/");
    expect(safeNext("/mine\n", "/")).toBe("/");
    expect(safeNext("/mine\\home", "/")).toBe("/");
    expect(safeNext("/%2f%2fevil.test", "/")).toBe("/");
    expect(safeNext("/%09/mine", "/")).toBe("/");
    expect(safeNext("/browse?q=%E7%94%B5%E6%A2%AF", "/")).toBe("/browse?q=%E7%94%B5%E6%A2%AF");
    expect(safeMarkdownUrl("javascript:alert(1)")).toBe("");
    expect(safeMarkdownUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeMarkdownUrl("/works/1")).toBe("/works/1");
    expect(browseHref({})).toBe("/browse");
    expect(browseHref({ kind: "novel", category: "urban", q: "电梯" })).toBe(
      "/browse?kind=novel&category=urban&q=%E7%94%B5%E6%A2%AF",
    );
  });

  it("坏掉的审核 JSON 不当成结果", () => {
    expect(parseReview(null)).toBeNull();
    expect(parseReview("{")).toBeNull();
    expect(parseReview('{"score":"高"}')).toBeNull();
    expect(formatDate("not-a-date")).toBe("");
  });

  it("测试数据目录离开项目里的正式库", () => {
    expect(dataDir()).toContain("moben-test-");
    expect(dataDir()).not.toContain(`${"data"}${pathSep()}moben.sqlite`);
  });
});

function pathSep() {
  return process.platform === "win32" ? "\\" : "/";
}

describe("密码", () => {
  it("正确密码能对上，错误密码和坏记录对不上", () => {
    const stored = hashPassword("demo1234");
    expect(verifyPassword("demo1234", stored)).toBe(true);
    expect(verifyPassword("demo1235", stored)).toBe(false);
    expect(verifyPassword("demo1234", "nope")).toBe(false);
  });
});
