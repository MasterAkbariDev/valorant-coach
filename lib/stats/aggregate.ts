import type { CareerSnapshot, MatchSummary } from "@/types/valorant";
import { topEntries } from "@/lib/stats/timeline";

export type PoolRate = { games: number; wins: number; winRate: number; avgAcs: number };

export type AbilityAverages = {
  ability1: number;
  ability2: number;
  grenade: number;
  ultimate: number;
};

export type RankedInsights = {
  sampleSize: number;
  wins: number;
  losses: number;
  winRate: number;
  kd: number;
  avgAcs: number;
  avgAdr: number;
  avgHeadshotPercent: number;
  firstBloods: number;
  firstDeaths: number;
  firstBloodToDeathRatio: number;
  netRr: number;
  untradedDeaths: number;
  tradedDeaths: number;
  plants: number;
  earlyFirstDeaths: number;
  spawnRounds: number;
  avgSpent: number;
  form: string;
  streak: string;
  mainAgent: string | null;
  worstMap: string | null;
  worstCombo: string | null;
  lowImpactGames: number;
  agentWinRates: Record<string, PoolRate>;
  mapWinRates: Record<string, PoolRate>;
  comboWinRates: Record<string, PoolRate>;
  abilityAverages: Record<string, AbilityAverages>;
  isolatedDeaths: number;
  supportedDeaths: number;
  deathWeapons: string[];
  killWeapons: string[];
  deathsByTime: { early: number; mid: number; late: number };
  killsByTime: { early: number; mid: number; late: number };
  career: CareerSnapshot | null;
};

function rate(games: number, wins: number, acsTotal: number): PoolRate {
  return {
    games,
    wins,
    winRate: games ? Math.round((wins / games) * 1000) / 10 : 0,
    avgAcs: games ? Math.round(acsTotal / games) : 0,
  };
}

export function aggregateMatches(matches: MatchSummary[], career?: CareerSnapshot | null): RankedInsights {
  const sampleSize = matches.length;
  const wins = matches.filter((match) => match.result === "win").length;
  const losses = matches.filter((match) => match.result === "loss").length;
  const kills = matches.reduce((sum, match) => sum + match.kills, 0);
  const deaths = matches.reduce((sum, match) => sum + match.deaths, 0);
  const firstBloods = matches.reduce((sum, match) => sum + match.firstBloods, 0);
  const firstDeaths = matches.reduce((sum, match) => sum + match.firstDeaths, 0);

  const agents: Record<string, { games: number; wins: number; acs: number }> = {};
  const maps: Record<string, { games: number; wins: number; acs: number }> = {};
  const combos: Record<string, { games: number; wins: number; acs: number }> = {};
  const abilities: Record<string, AbilityAverages & { games: number }> = {};

  for (const match of matches) {
    const agent = agents[match.agent] ?? { games: 0, wins: 0, acs: 0 };
    agent.games += 1;
    agent.acs += match.acs;
    if (match.result === "win") agent.wins += 1;
    agents[match.agent] = agent;

    const map = maps[match.map] ?? { games: 0, wins: 0, acs: 0 };
    map.games += 1;
    map.acs += match.acs;
    if (match.result === "win") map.wins += 1;
    maps[match.map] = map;

    const comboKey = `${match.agent} on ${match.map}`;
    const combo = combos[comboKey] ?? { games: 0, wins: 0, acs: 0 };
    combo.games += 1;
    combo.acs += match.acs;
    if (match.result === "win") combo.wins += 1;
    combos[comboKey] = combo;

    const casts = match.abilityCasts;
    if (casts) {
      const bucket = abilities[match.agent] ?? {
        games: 0,
        ability1: 0,
        ability2: 0,
        grenade: 0,
        ultimate: 0,
      };
      bucket.games += 1;
      bucket.ability1 += casts.ability1 ?? 0;
      bucket.ability2 += casts.ability2 ?? 0;
      bucket.grenade += casts.grenade ?? 0;
      bucket.ultimate += casts.ultimate ?? 0;
      abilities[match.agent] = bucket;
    }
  }

  const agentWinRates = Object.fromEntries(
    Object.entries(agents).map(([name, value]) => [name, rate(value.games, value.wins, value.acs)]),
  );
  const mapWinRates = Object.fromEntries(
    Object.entries(maps).map(([name, value]) => [name, rate(value.games, value.wins, value.acs)]),
  );
  const comboWinRates = Object.fromEntries(
    Object.entries(combos).map(([name, value]) => [name, rate(value.games, value.wins, value.acs)]),
  );
  const mainAgent =
    Object.entries(agentWinRates).sort((a, b) => b[1].games - a[1].games)[0]?.[0] ?? null;
  const worstMap =
    Object.entries(mapWinRates)
      .filter(([, stats]) => stats.games >= 2)
      .sort((a, b) => a[1].winRate - b[1].winRate)[0]?.[0] ?? null;
  const worstCombo =
    Object.entries(comboWinRates)
      .filter(([, stats]) => stats.games >= 2)
      .sort((a, b) => a[1].winRate - b[1].winRate)[0]?.[0] ?? null;

  const formMatches = matches.slice(0, 5);
  const form = formMatches.map((match) => (match.result === "win" ? "W" : match.result === "loss" ? "L" : "-")).join("");
  let streakCount = 0;
  const streakResult = matches[0]?.result;
  for (const match of matches) {
    if (match.result !== streakResult || (match.result !== "win" && match.result !== "loss")) break;
    streakCount += 1;
  }

  return {
    sampleSize,
    wins,
    losses,
    winRate: sampleSize ? Math.round((wins / sampleSize) * 1000) / 10 : 0,
    kd: deaths ? Math.round((kills / deaths) * 100) / 100 : kills,
    avgAcs: sampleSize ? Math.round(matches.reduce((sum, match) => sum + match.acs, 0) / sampleSize) : 0,
    avgAdr: sampleSize
      ? Math.round(matches.reduce((sum, match) => sum + (match.adr ?? 0), 0) / sampleSize)
      : 0,
    avgHeadshotPercent: sampleSize
      ? Math.round((matches.reduce((sum, match) => sum + match.headshotPercent, 0) / sampleSize) * 10) / 10
      : 0,
    firstBloods,
    firstDeaths,
    firstBloodToDeathRatio: firstDeaths ? Math.round((firstBloods / firstDeaths) * 100) / 100 : firstBloods,
    netRr: matches.reduce((sum, match) => sum + (match.rrChange ?? 0), 0),
    untradedDeaths: matches.reduce((sum, match) => sum + (match.untradedDeaths ?? 0), 0),
    tradedDeaths: matches.reduce((sum, match) => sum + (match.tradedDeaths ?? 0), 0),
    plants: matches.reduce((sum, match) => sum + (match.plants ?? 0), 0),
    earlyFirstDeaths: matches.reduce((sum, match) => sum + (match.earlyFirstDeaths ?? 0), 0),
    spawnRounds: matches.reduce((sum, match) => sum + (match.roundsInSpawn ?? 0), 0),
    avgSpent: sampleSize
      ? Math.round(matches.reduce((sum, match) => sum + (match.spentAvg ?? 0), 0) / sampleSize)
      : 0,
    form,
    streak:
      streakCount && (streakResult === "win" || streakResult === "loss")
        ? `${streakCount}${streakResult === "win" ? "W" : "L"}`
        : "none",
    mainAgent,
    worstMap,
    worstCombo,
    lowImpactGames: matches.filter((match) => match.acs < 180).length,
    agentWinRates,
    mapWinRates,
    comboWinRates,
    abilityAverages: Object.fromEntries(
      Object.entries(abilities).map(([name, value]) => [
        name,
        {
          ability1: round1(value.ability1 / value.games),
          ability2: round1(value.ability2 / value.games),
          grenade: round1(value.grenade / value.games),
          ultimate: round1(value.ultimate / value.games),
        },
      ]),
    ),
    isolatedDeaths: matches.reduce((sum, match) => sum + (match.timeline?.isolatedDeaths ?? 0), 0),
    supportedDeaths: matches.reduce((sum, match) => sum + (match.timeline?.supportedDeaths ?? 0), 0),
    deathWeapons: topEntries(
      matches.reduce((counts, match) => {
        for (const [weapon, count] of Object.entries(match.timeline?.deathWeapons ?? {})) {
          counts[weapon] = (counts[weapon] ?? 0) + count;
        }
        return counts;
      }, {} as Record<string, number>),
    ),
    killWeapons: topEntries(
      matches.reduce((counts, match) => {
        for (const [weapon, count] of Object.entries(match.timeline?.killWeapons ?? {})) {
          counts[weapon] = (counts[weapon] ?? 0) + count;
        }
        return counts;
      }, {} as Record<string, number>),
    ),
    deathsByTime: matches.reduce(
      (sum, match) => ({
        early: sum.early + (match.timeline?.deathsByTime.early ?? 0),
        mid: sum.mid + (match.timeline?.deathsByTime.mid ?? 0),
        late: sum.late + (match.timeline?.deathsByTime.late ?? 0),
      }),
      { early: 0, mid: 0, late: 0 },
    ),
    killsByTime: matches.reduce(
      (sum, match) => ({
        early: sum.early + (match.timeline?.killsByTime.early ?? 0),
        mid: sum.mid + (match.timeline?.killsByTime.mid ?? 0),
        late: sum.late + (match.timeline?.killsByTime.late ?? 0),
      }),
      { early: 0, mid: 0, late: 0 },
    ),
    career: career ?? null,
  };
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
