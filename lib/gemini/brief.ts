import { lookupAgent, type ValorantContent } from "@/lib/valorant/content";
import type { PoolRate, RankedInsights } from "@/lib/stats/aggregate";
import type { MatchSummary } from "@/types/valorant";

const SLOT_KEY = {
  Ability1: "ability1",
  Ability2: "ability2",
  Grenade: "grenade",
  Ultimate: "ultimate",
} as const;

function prune(value: unknown): unknown {
  if (Array.isArray(value)) {
    const next = value.map(prune).filter((item) => item !== undefined && item !== null && item !== "");
    return next.length ? next : undefined;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const next = prune(item);
      if (next === undefined || next === null || next === "") continue;
      out[key] = next;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return value;
}

function poolLine(name: string, stats: PoolRate) {
  return `${name} ${stats.games}g ${stats.winRate}% WR ${stats.avgAcs} ACS ${stats.rating}/1000`;
}

function notablePools(rates: Record<string, PoolRate>, keep: Array<string | null | undefined>, limit = 4) {
  const pinned = new Set(keep.filter(Boolean) as string[]);
  return Object.entries(rates)
    .filter(([name, stats]) => pinned.has(name) || stats.games >= 2)
    .sort((a, b) => {
      const pin = Number(pinned.has(b[0])) - Number(pinned.has(a[0]));
      if (pin) return pin;
      return b[1].games - a[1].games;
    })
    .slice(0, limit)
    .map(([name, stats]) => poolLine(name, stats));
}

function topWeapons(counts: Record<string, number> | undefined, limit = 2) {
  if (!counts) return undefined;
  const rows = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => `${name}×${count}`);
  return rows.length ? rows : undefined;
}

export type CoachBrief = {
  player?: string;
  rank?: string;
  peak?: string;
  rr?: number;
  overall?: {
    games?: number;
    record?: string;
    wr?: string;
    form?: string;
    streak?: string;
    kd?: number;
    acs?: number;
    adr?: number;
    hs?: string;
    plants?: number;
    spend?: number;
    netRr?: number;
  };
  flags?: string[];
  games?: unknown[];
};

export function buildCoachBrief(input: {
  identity: { name: string; tag: string; region: string };
  insights: RankedInsights;
  matches: MatchSummary[];
  content?: ValorantContent | null;
}): CoachBrief {
  const { insights, matches, identity, content } = input;
  const highFragLosses = matches.filter(
    (match) => match.result === "loss" && match.kills >= 20 && match.acs >= 250,
  );
  const quietGames = matches.filter((match) => match.acs < 180);
  const openerNegative = insights.firstDeaths > insights.firstBloods;
  const mainAgent = insights.mainAgent ? lookupAgent(content ?? null, insights.mainAgent) : null;
  const mainCasts = insights.mainAgent ? insights.abilityAverages[insights.mainAgent] : null;

  const flags: string[] = [];
  if (insights.streak && insights.streak !== "none") {
    flags.push(`Current streak: ${insights.streak}. Last 5: ${insights.form || "n/a"}.`);
  }
  if (insights.mainAgent) {
    const main = insights.agentWinRates[insights.mainAgent];
    flags.push(`Main ${insights.mainAgent}: ${main.games} games, ${main.winRate}% WR, ${main.avgAcs} ACS.`);
  }
  if (insights.worstMap) {
    const map = insights.mapWinRates[insights.worstMap];
    flags.push(`Worst map ${insights.worstMap}: ${map.wins}/${map.games} (${map.winRate}%).`);
  }
  if (insights.worstCombo) {
    const combo = insights.comboWinRates[insights.worstCombo];
    flags.push(`Worst combo ${insights.worstCombo}: ${combo.wins}/${combo.games} (${combo.winRate}%).`);
  }
  for (const [name, stats] of Object.entries(insights.agentWinRates)) {
    if (stats.games >= 2 && stats.winRate <= 20) {
      flags.push(`${name} is a leak: ${stats.wins}/${stats.games} wins.`);
    }
  }
  if (openerNegative) {
    flags.push(`Died first more than they opened: ${insights.firstDeaths} FD vs ${insights.firstBloods} FB.`);
  }
  if (insights.earlyFirstDeaths >= 4) {
    flags.push(`${insights.earlyFirstDeaths} first deaths in the first 12s.`);
  }
  if (insights.untradedDeaths > insights.tradedDeaths && insights.untradedDeaths >= 8) {
    flags.push(`${insights.untradedDeaths} untraded vs ${insights.tradedDeaths} traded.`);
  }
  if (mainAgent?.role === "Duelist" && insights.plants < matches.length) {
    flags.push(`Duelist ${insights.mainAgent} planted ${insights.plants} times in ${matches.length} games.`);
  }
  if (insights.spawnRounds >= 3) {
    flags.push(`${insights.spawnRounds} spawn rounds.`);
  }
  if (quietGames.length) flags.push(`${quietGames.length} games under 180 ACS.`);
  if (highFragLosses.length) {
    flags.push(`${highFragLosses.length} high-frag losses (20+ kills, 250+ ACS).`);
  }
  if (insights.avgHeadshotPercent < 22) {
    flags.push(`HS ${insights.avgHeadshotPercent}%.`);
  }
  if (insights.avgAdr && insights.avgAdr < 140) {
    flags.push(`ADR ${insights.avgAdr}.`);
  }
  if (insights.isolatedDeaths >= 6) {
    flags.push(`${insights.isolatedDeaths} isolated deaths vs ${insights.supportedDeaths} with help.`);
  }
  if (insights.deathsByTime.early >= insights.deathsByTime.mid && insights.deathsByTime.early >= 6) {
    flags.push(
      `Death timing ${insights.deathsByTime.early} early / ${insights.deathsByTime.mid} mid / ${insights.deathsByTime.late} late.`,
    );
  }
  if (insights.deathWeapons.length) flags.push(`Died most to ${insights.deathWeapons.join(", ")}.`);

  const deathSamples = matches
    .map((match) => match.timeline?.worstDeath)
    .filter((item): item is string => Boolean(item))
    .slice(0, 8);

  const games = matches.map((match) => {
    const timeline = match.timeline;
    return prune({
      map: match.map,
      agent: match.agent,
      result: match.result,
      score:
        match.roundsWon != null && match.roundsLost != null ? `${match.roundsWon}-${match.roundsLost}` : undefined,
      kda: `${match.kills}/${match.deaths}/${match.assists}`,
      acs: match.acs,
      rr: match.rrChange,
      deaths: prune({
        fb: match.firstBloods || undefined,
        fd: match.firstDeaths || undefined,
        earlyFd: match.earlyFirstDeaths || undefined,
        untraded: match.untradedDeaths || undefined,
        isolated: timeline?.isolatedDeaths || undefined,
        weapons: topWeapons(timeline?.deathWeapons),
        worst: timeline?.worstDeath,
      }),
    });
  });

  return prune({
    player: `${identity.name}#${identity.tag}`,
    rank: insights.career?.currentRank ?? "Unknown",
    peak: insights.career?.peakRank,
    rr: insights.career?.rankingInTier,
    overall: {
      games: insights.sampleSize,
      record: `${insights.wins}-${insights.losses}`,
      wr: `${insights.winRate}%`,
      form: insights.form,
      streak: insights.streak,
      kd: insights.kd,
      acs: insights.avgAcs,
      adr: insights.avgAdr,
      hs: `${insights.avgHeadshotPercent}%`,
      plants: insights.plants,
      spend: insights.avgSpent,
      netRr: insights.netRr,
    },
    deaths: {
      fb: insights.firstBloods,
      fd: insights.firstDeaths,
      earlyFd: insights.earlyFirstDeaths,
      untraded: insights.untradedDeaths,
      traded: insights.tradedDeaths,
      isolated: insights.isolatedDeaths,
      supported: insights.supportedDeaths,
      weapons: insights.deathWeapons,
      timing: insights.deathsByTime,
      samples: deathSamples,
    },
    pool: {
      main: insights.mainAgent,
      role: mainAgent?.role,
      abilities: mainAgent?.abilities
        .filter((ability) => ability.slot in SLOT_KEY)
        .map((ability) => {
          const key = SLOT_KEY[ability.slot as keyof typeof SLOT_KEY];
          return `${ability.name} ${mainCasts?.[key] ?? 0}/g`;
        }),
      worstMap: insights.worstMap,
      worstCombo: insights.worstCombo,
      agents: notablePools(insights.agentWinRates, [insights.mainAgent]),
      maps: notablePools(insights.mapWinRates, [insights.worstMap]),
    },
    flags,
    games,
  }) as CoachBrief;
}
