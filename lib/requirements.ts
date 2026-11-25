import { MIN_REQUIREMENT_YUAN } from "@/lib/pricing";

export const REQUIREMENT_STATUSES = [
  { id: "awaiting_pay", label: "待付款" },
  { id: "paid", label: "征稿中" },
  { id: "making", label: "制作中" },
  { id: "delivered", label: "已交付" },
] as const;

export type RequirementStatusId = (typeof REQUIREMENT_STATUSES)[number]["id"];

export function requirementStatusLabel(status: string) {
  return REQUIREMENT_STATUSES.find((item) => item.id === status)?.label ?? status;
}

export function isPaidRequirementStatus(status: string) {
  return status === "paid" || status === "making" || status === "delivered";
}

export function parseBountyYuan(raw: FormDataEntryValue | string | number | null | undefined) {
  const n = Number(String(raw ?? "").trim());
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < MIN_REQUIREMENT_YUAN) return null;
  if (n > 100_000) return null;
  return n;
}
