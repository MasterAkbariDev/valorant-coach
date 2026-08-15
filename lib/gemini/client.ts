import { generateCoachText } from "@/lib/ai/coach";
import { adviceIsUsable } from "@/lib/gemini/advice";
import { buildCoachBrief } from "@/lib/gemini/brief";
import { generateContentWithFallback } from "@/lib/gemini/generate";
import { rankedCoachSystem } from "@/lib/gemini/prompts";
import type { RankedInsights } from "@/lib/stats/aggregate";
import { loadValorantContent } from "@/lib/valorant/content";
import type { MatchAdvice } from "@/types/analysis";
import type { MatchSummary } from "@/types/valorant";

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
    items: Array.isArray(parsed.items) ? parsed.items.slice(0, 5) : [],
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
    "Use flags and death samples first. Cite abilities, maps, untraded/isolated deaths, weapons, and worstDeath lines.",
    "If they should stop queueing an agent or map, say that in the title.",
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

export async function pingGemini() {
  const { text, model } = await generateContentWithFallback({
    contents: "Reply with the single word pong",
  });
  return { reply: text.trim(), model };
}
