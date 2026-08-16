import type { MatchDetail, MatchSummary, PlayerIdentity } from "@/types/valorant";
import { extractTimeline } from "@/lib/stats/timeline";

type Json = Record<string, unknown>;

function asObj(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
}

function asArr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function num(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function named(value: unknown) {
  const obj = asObj(value);
  return str(obj.name) || str(obj.id);
}

function playerMatches(player: Json, identity: PlayerIdentity) {
  const name = str(player.name).toLowerCase();
  const tag = str(player.tag).toLowerCase();
  if (identity.puuid && str(player.puuid) === identity.puuid) return true;
  return name === identity.name.toLowerCase() && tag === identity.tag.toLowerCase();
}

function findPlayer(match: Json, identity: PlayerIdentity): Json | null {
  const hit = asArr(match.players).find((player) => playerMatches(asObj(player), identity));
  return hit ? asObj(hit) : null;
}

function headshotPercent(stats: Json) {
  const hs = num(stats.headshots);
  const body = num(stats.bodyshots);
  const legs = num(stats.legshots);
  const total = hs + body + legs;
  if (!total) return 0;
  return Math.round((hs / total) * 1000) / 10;
}

function firstBloodStats(match: Json, puuid: string) {
  const kills = asArr(match.kills).map(asObj);
  const byRound = new Map<number, Json>();
  for (const kill of kills) {
    const round = num(kill.round);
    const existing = byRound.get(round);
    if (!existing || num(kill.time_in_round_in_ms) < num(existing.time_in_round_in_ms)) {
      byRound.set(round, kill);
    }
  }
  let firstBloods = 0;
  let firstDeaths = 0;
  for (const kill of byRound.values()) {
    if (str(asObj(kill.killer).puuid) === puuid) firstBloods += 1;
    if (str(asObj(kill.victim).puuid) === puuid) firstDeaths += 1;
  }
  return { firstBloods, firstDeaths };
}

function matchResult(match: Json, teamId: string): MatchSummary["result"] {
  const teams = asArr(match.teams).map(asObj);
  const team = teams.find((item) => str(item.team_id) === teamId);
  if (!team) return "unknown";
  if (team.won === true) return "win";
  if (team.won === false) {
    const otherWon = teams.some((item) => item !== team && item.won === true);
    return otherWon ? "loss" : "draw";
  }
  return "unknown";
}

function roundCount(match: Json) {
  const rounds = asArr(match.rounds);
  if (rounds.length) return rounds.length;
  const teams = asArr(match.teams).map(asObj);
  const won = teams.reduce((sum, team) => sum + num(asObj(team.rounds).won), 0);
  return won || 1;
}

function teamRoundScore(match: Json, teamId: string) {
  const team = asArr(match.teams)
    .map(asObj)
    .find((item) => str(item.team_id) === teamId);
  const rounds = asObj(team?.rounds);
  return { won: num(rounds.won), lost: num(rounds.lost) };
}

function plantCount(match: Json, puuid: string) {
  return asArr(match.rounds).filter((round) => str(asObj(asObj(asObj(round).plant).player).puuid) === puuid).length;
}

function tradeStats(match: Json, puuid: string) {
  const kills = asArr(match.kills).map(asObj);
  const deaths = kills.filter((kill) => str(asObj(kill.victim).puuid) === puuid);
  let tradedDeaths = 0;
  let untradedDeaths = 0;
  let earlyFirstDeaths = 0;
  const firstInRound = new Map<number, Json>();
  for (const kill of kills) {
    const round = num(kill.round);
    const existing = firstInRound.get(round);
    if (!existing || num(kill.time_in_round_in_ms) < num(existing.time_in_round_in_ms)) {
      firstInRound.set(round, kill);
    }
  }
  for (const death of firstInRound.values()) {
    if (str(asObj(death.victim).puuid) === puuid && num(death.time_in_round_in_ms) < 12000) {
      earlyFirstDeaths += 1;
    }
  }
  for (const death of deaths) {
    const round = num(death.round);
    const at = num(death.time_in_round_in_ms);
    const killerId = str(asObj(death.killer).puuid);
    const traded = kills.some((kill) => {
      if (num(kill.round) !== round) return false;
      if (str(asObj(kill.victim).puuid) !== killerId) return false;
      if (str(asObj(kill.killer).puuid) === puuid) return false;
      const delay = num(kill.time_in_round_in_ms) - at;
      return delay >= 0 && delay <= 6000;
    });
    if (traded) tradedDeaths += 1;
    else untradedDeaths += 1;
  }
  return { tradedDeaths, untradedDeaths, earlyFirstDeaths };
}

export function normalizeMatch(raw: unknown, identity: PlayerIdentity): MatchDetail | null {
  const match = asObj(raw);
  const metadata = asObj(match.metadata);
  const player = findPlayer(match, identity);
  if (!player) return null;

  const stats = asObj(player.stats);
  const damage = asObj(stats.damage);
  const economy = asObj(player.economy);
  const behavior = asObj(player.behavior);
  const rounds = roundCount(match);
  const score = num(stats.score);
  const puuid = str(player.puuid);
  const fb = firstBloodStats(match, puuid);
  const teamId = str(player.team_id);
  const queue = asObj(metadata.queue);
  const board = teamRoundScore(match, teamId);
  const trades = tradeStats(match, puuid);
  const dealt = num(damage.dealt);

  const summary: MatchSummary = {
    matchId: str(metadata.match_id),
    map: named(metadata.map) || "Unknown",
    mode: str(queue.name) || str(queue.id) || "unknown",
    queue: str(queue.id) || "unknown",
    startedAt: str(metadata.started_at),
    result: matchResult(match, teamId),
    agent: named(player.agent) || "Unknown",
    kills: num(stats.kills),
    deaths: num(stats.deaths),
    assists: num(stats.assists),
    acs: rounds ? Math.round(score / rounds) : score,
    headshotPercent: headshotPercent(stats),
    firstBloods: fb.firstBloods,
    firstDeaths: fb.firstDeaths,
    agentId: str(asObj(player.agent).id) || undefined,
    abilityCasts: {
      ability1: num(asObj(player.ability_casts).ability1, 0),
      ability2: num(asObj(player.ability_casts).ability2, 0),
      grenade: num(asObj(player.ability_casts).grenade, 0),
      ultimate: num(asObj(player.ability_casts).ultimate, 0),
    },
    roundsWon: board.won,
    roundsLost: board.lost,
    adr: rounds ? Math.round(dealt / rounds) : dealt,
    damageDealt: dealt,
    damageReceived: num(damage.received),
    plants: plantCount(match, puuid),
    tradedDeaths: trades.tradedDeaths,
    untradedDeaths: trades.untradedDeaths,
    earlyFirstDeaths: trades.earlyFirstDeaths,
    afkRounds: num(behavior.afk_rounds),
    roundsInSpawn: num(behavior.rounds_in_spawn),
    spentAvg: num(asObj(economy.spent).average),
    loadoutAvg: num(asObj(economy.loadout_value).average),
    timeline: extractTimeline(match, puuid, teamId),
  };

  return {
    ...summary,
    rounds: asArr(match.rounds),
    killsTimeline: asArr(match.kills),
    economy,
    raw: {
      behavior: player.behavior,
      ability_casts: player.ability_casts,
      damage,
      teamId,
      puuid,
      tier: player.tier,
    },
  };
}

export function compactMatch(detail: MatchDetail) {
  return {
    matchId: detail.matchId,
    map: detail.map,
    mode: detail.mode,
    queue: detail.queue,
    startedAt: detail.startedAt,
    result: detail.result,
    agent: detail.agent,
    kills: detail.kills,
    deaths: detail.deaths,
    assists: detail.assists,
    acs: detail.acs,
    headshotPercent: detail.headshotPercent,
    firstBloods: detail.firstBloods,
    firstDeaths: detail.firstDeaths,
    rrChange: detail.rrChange,
    agentId: detail.agentId,
    abilityCasts: detail.abilityCasts,
    roundsWon: detail.roundsWon,
    roundsLost: detail.roundsLost,
    adr: detail.adr,
    damageDealt: detail.damageDealt,
    damageReceived: detail.damageReceived,
    plants: detail.plants,
    tradedDeaths: detail.tradedDeaths,
    untradedDeaths: detail.untradedDeaths,
    earlyFirstDeaths: detail.earlyFirstDeaths,
    afkRounds: detail.afkRounds,
    roundsInSpawn: detail.roundsInSpawn,
    spentAvg: detail.spentAvg,
    loadoutAvg: detail.loadoutAvg,
    timeline: detail.timeline,
  };
}
