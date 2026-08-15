export type RatingTier = "S" | "A" | "B" | "C" | "D";

export type RatingMeta = {
  score: number;
  tier: RatingTier;
  color: string;
  shape: "hex" | "diamond" | "square" | "circle" | "octagon";
};

const TIER_STYLE: Record<RatingTier, Omit<RatingMeta, "score" | "tier">> = {
  S: { color: "#4da2ff", shape: "hex" },
  A: { color: "#3dd68c", shape: "diamond" },
  B: { color: "#e8b84a", shape: "square" },
  C: { color: "#9aa0ae", shape: "circle" },
  D: { color: "#ff6b8a", shape: "octagon" },
};

export function poolRating(input: {
  games: number;
  winRate: number;
  avgAcs: number;
  kd: number;
  avgAdr: number;
}) {
  const winScore = Math.min(100, Math.max(0, input.winRate)) * 4;
  const acsScore = Math.min(1, Math.max(0, input.avgAcs / 350)) * 350;
  const kdScore = Math.min(1, Math.max(0, input.kd / 2)) * 150;
  const adrScore = Math.min(1, Math.max(0, input.avgAdr / 180)) * 100;
  const raw = winScore + acsScore + kdScore + adrScore;
  const confidence = Math.min(1, input.games / 4);
  return Math.round(Math.min(1000, Math.max(0, 500 + (raw - 500) * confidence)));
}

export function ratingTier(score: number): RatingTier {
  if (score >= 750) return "S";
  if (score >= 600) return "A";
  if (score >= 450) return "B";
  if (score >= 300) return "C";
  return "D";
}

export function ratingMeta(score: number): RatingMeta {
  const tier = ratingTier(score);
  return { score, tier, ...TIER_STYLE[tier] };
}
