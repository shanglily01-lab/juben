import { describe, expect, it } from "vitest";

import { MIN_REQUIREMENT_COINS } from "@/lib/pricing";
import { parseBountyCoins, requirementStatusLabel } from "@/lib/requirements";

describe("requirements", () => {
  it("rejects bounty below minimum coins", () => {
    expect(parseBountyCoins(MIN_REQUIREMENT_COINS - 1)).toBeNull();
    expect(parseBountyCoins("999")).toBeNull();
  });

  it("accepts integer bounty at or above minimum coins", () => {
    expect(parseBountyCoins(MIN_REQUIREMENT_COINS)).toBe(MIN_REQUIREMENT_COINS);
    expect(parseBountyCoins("2000")).toBe(2000);
  });

  it("labels statuses", () => {
    expect(requirementStatusLabel("paid")).toBe("征稿中");
    expect(requirementStatusLabel("delivered")).toBe("已交付");
  });
});
