import type { MatchAdvice } from "@/types/analysis";

export const EMPTY_SUMMARY = "Not enough signal to coach from this sample.";

export function adviceIsUsable(advice?: MatchAdvice | null) {
  if (!advice?.summary?.trim()) return false;
  if (advice.summary.trim() === EMPTY_SUMMARY) return false;
  return Array.isArray(advice.items) && advice.items.length >= 2 && Boolean(advice.items[0]?.title);
}
