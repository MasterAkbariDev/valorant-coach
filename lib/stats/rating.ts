export type RatingTier = "S" | "A" | "B" | "C" | "D";

export type RatingMeta = {
  score: number;
  tier: RatingTier;
  color: string;
};

const TIER_COLOR: Record<RatingTier, string> = {
  S: "#4da2ff",
  A: "#3dd68c",
  B: "#e8b84a",
  C: "#9aa0ae",
  D: "#ff6b8a",
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

/** 0-1000 score for one game: combat output, trades opened, and the result. */
export function matchRating(input: {
  result: "win" | "loss" | "draw" | "unknown";
  kills: number;
  deaths: number;
  acs: number;
  adr?: number;
  headshotPercent: number;
  firstBloods: number;
  firstDeaths: number;
}) {
  const kd = input.kills / Math.max(1, input.deaths);
  const acsScore = Math.min(1, input.acs / 400) * 320;
  const kdScore = Math.min(1, kd / 2.4) * 240;
  const adrScore = Math.min(1, (input.adr ?? input.acs * 0.65) / 200) * 160;
  const hsScore = Math.min(1, input.headshotPercent / 32) * 80;
  const openers = Math.max(-60, Math.min(60, (input.firstBloods - input.firstDeaths) * 20)) + 60;
  const resultBonus = input.result === "win" ? 80 : input.result === "draw" ? 40 : 0;
  return Math.round(Math.min(1000, Math.max(0, acsScore + kdScore + adrScore + hsScore + openers + resultBonus)));
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
  return { score, tier, color: TIER_COLOR[tier] };
}
