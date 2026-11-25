import { describe, expect, it } from "vitest";

import { MIN_REQUIREMENT_YUAN } from "@/lib/pricing";
import { parseBountyYuan, requirementStatusLabel } from "@/lib/requirements";

describe("requirements", () => {
  it("rejects bounty below minimum", () => {
    expect(parseBountyYuan(MIN_REQUIREMENT_YUAN - 1)).toBeNull();
    expect(parseBountyYuan("199")).toBeNull();
  });

  it("accepts integer bounty at or above minimum", () => {
    expect(parseBountyYuan(MIN_REQUIREMENT_YUAN)).toBe(MIN_REQUIREMENT_YUAN);
    expect(parseBountyYuan("500")).toBe(500);
  });

  it("labels statuses", () => {
    expect(requirementStatusLabel("paid")).toBe("征稿中");
    expect(requirementStatusLabel("delivered")).toBe("已交付");
  });
});
