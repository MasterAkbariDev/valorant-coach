import type { MatchAdvice } from "@/types/analysis";

export const EMPTY_SUMMARY = "Not enough signal to coach from this sample.";

export function adviceIsUsable(advice?: MatchAdvice | null) {
  if (!advice?.summary?.trim()) return false;
  if (advice.summary.trim() === EMPTY_SUMMARY) return false;
  return Array.isArray(advice.items) && advice.items.length >= 2 && Boolean(advice.items[0]?.title);
}

function norm(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function adviceLooksSame(left?: MatchAdvice | null, right?: MatchAdvice | null) {
  if (!left || !right) return false;
  const pack = (advice: MatchAdvice) =>
    JSON.stringify({
      summary: norm(advice.summary),
      items: advice.items.map((item) => [norm(item.title), norm(item.evidence), norm(item.suggestion)]),
    });
  return pack(left) === pack(right);
}
