import { generateCoachText } from "@/lib/ai/coach";
import { adviceIsUsable } from "@/lib/gemini/advice";
import { buildCoachBrief } from "@/lib/gemini/brief";
import { generateContentWithFallback } from "@/lib/gemini/generate";
import { matchReviewSchema, matchReviewSystem, rankedCoachSystem } from "@/lib/gemini/prompts";
import type { RankedInsights } from "@/lib/stats/aggregate";
import { matchRating } from "@/lib/stats/rating";
import { extractEvents } from "@/lib/stats/timeline";
import { loadValorantContent } from "@/lib/valorant/content";
import type { MatchAdvice, MatchReview } from "@/types/analysis";
import type { MatchDetail, MatchSummary } from "@/types/valorant";

function extractJson(raw: string) {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) return cleaned.slice(start, end + 1);
  return cleaned;
}

function parseAdvice(raw: string): MatchAdvice {
  const parsed = JSON.parse(extractJson(raw)) as MatchAdvice;
  const advice: MatchAdvice = {
    matchId: "overall",
    summary: parsed.summary?.trim() || "",
    items: Array.isArray(parsed.items) ? parsed.items.slice(0, 6) : [],
  };
  if (!adviceIsUsable(advice)) {
    throw new Error("Empty coaching notes");
  }
  return advice;
}

export async function analyzeRankedStats(payload: {
  identity: { name: string; tag: string; region: string };
  insights: RankedInsights;
  matches: MatchSummary[];
  warnings: string[];
}): Promise<MatchAdvice> {
  const player = `${payload.identity.name}#${payload.identity.tag}`;
  const content = await loadValorantContent().catch(() => null);
  const brief = buildCoachBrief({ ...payload, content });
  const prompt = [
    `Coach ${player} (${brief.rank ?? "Unknown"}, ${brief.overall?.record ?? "?"} in the last ${brief.overall?.games ?? "?"} ranked games).`,
    "Diagnose the biggest RR leak first, then separate aim from decision problems using damageDelta, HS%, and ADR.",
    "Use flags, per-game ratings, and worstDeath samples. Cite abilities, maps, untraded/isolated deaths, and weapons.",
    "If they should stop queueing an agent or map, say that in the title. Give a drill on every card.",
    JSON.stringify(brief),
  ].join("\n\n");

  const { text } = await generateCoachText({
    system: rankedCoachSystem(player),
    user: prompt,
    accept: (value) => {
      try {
        return adviceIsUsable(parseAdvice(value));
      } catch {
        return false;
      }
    },
  });
  return parseAdvice(text);
}

function parseReview(raw: string, matchId: string): MatchReview {
  const parsed = JSON.parse(extractJson(raw)) as Partial<MatchReview>;
  const review: MatchReview = {
    matchId,
    summary: parsed.summary?.trim() || "",
    wrong: Array.isArray(parsed.wrong)
      ? parsed.wrong
          .filter((item) => item?.title?.trim() && item?.detail?.trim())
          .slice(0, 4)
      : [],
    actions: Array.isArray(parsed.actions)
      ? parsed.actions.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 4)
      : [],
  };
  if (!review.summary || !review.wrong.length || !review.actions.length) {
    throw new Error("Empty match review");
  }
  return review;
}

export async function reviewSingleMatch(payload: {
  identity: { name: string; tag: string };
  detail: MatchDetail;
}): Promise<MatchReview> {
  const { detail } = payload;
  const player = `${payload.identity.name}#${payload.identity.tag}`;
  const raw = (detail.raw ?? {}) as { teamId?: string; puuid?: string };
  const rounds = (detail.roundsWon ?? 0) + (detail.roundsLost ?? 0);
  const events = extractEvents(detail.killsTimeline, raw.puuid ?? "", raw.teamId ?? "");

  const brief = {
    player,
    map: detail.map,
    agent: detail.agent,
    result: detail.result,
    score: `${detail.roundsWon ?? "?"}-${detail.roundsLost ?? "?"}`,
    rating: matchRating(detail),
    kda: `${detail.kills}/${detail.deaths}/${detail.assists}`,
    acs: detail.acs,
    adr: detail.adr,
    hs: `${detail.headshotPercent}%`,
    damageDelta: rounds ? Math.round(((detail.damageDealt ?? 0) - (detail.damageReceived ?? 0)) / rounds) : undefined,
    fb: detail.firstBloods,
    fd: detail.firstDeaths,
    earlyFd: detail.earlyFirstDeaths,
    untraded: detail.untradedDeaths,
    traded: detail.tradedDeaths,
    isolated: detail.timeline?.isolatedDeaths,
    multiKillRounds: detail.timeline?.multiKillRounds,
    plants: detail.plants,
    spendAvg: detail.spentAvg,
    loadoutAvg: detail.loadoutAvg,
    rr: detail.rrChange,
    events,
  };

  const prompt = [
    `Review this one ${detail.map} game as ${detail.agent} for ${player} (${detail.result} ${brief.score}).`,
    "Read the events log like a VOD: quote rounds, clock times, and weapons. Say what decided the game, what went wrong, and what to do next game.",
    JSON.stringify(brief),
  ].join("\n\n");

  const { text } = await generateCoachText({
    system: matchReviewSystem(player),
    user: prompt,
    schema: matchReviewSchema,
    accept: (value) => {
      try {
        parseReview(value, detail.matchId);
        return true;
      } catch {
        return false;
      }
    },
  });
  return parseReview(text, detail.matchId);
}

export async function pingGemini() {
  const { text, model } = await generateContentWithFallback({
    contents: "Reply with the single word pong",
  });
  return { reply: text.trim(), model };
}
