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
  return str(obj.name) || str(obj.id) || "Unknown";
}

function point(value: unknown) {
  const obj = asObj(value);
  if (typeof obj.x !== "number" || typeof obj.y !== "number") return null;
  return { x: obj.x, y: obj.y };
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clock(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function bucket(ms: number): "early" | "mid" | "late" {
  if (ms < 12000) return "early";
  if (ms < 45000) return "mid";
  return "late";
}

const NEARBY = 2200;

export type TimelineDigest = {
  isolatedDeaths: number;
  supportedDeaths: number;
  deathWeapons: Record<string, number>;
  killWeapons: Record<string, number>;
  deathsByTime: { early: number; mid: number; late: number };
  killsByTime: { early: number; mid: number; late: number };
  worstDeath: string | null;
};

export function emptyTimeline(): TimelineDigest {
  return {
    isolatedDeaths: 0,
    supportedDeaths: 0,
    deathWeapons: {},
    killWeapons: {},
    deathsByTime: { early: 0, mid: 0, late: 0 },
    killsByTime: { early: 0, mid: 0, late: 0 },
    worstDeath: null,
  };
}

export function extractTimeline(match: unknown, puuid: string, teamId: string): TimelineDigest {
  const digest = emptyTimeline();
  const kills = asArr(asObj(match).kills).map(asObj);
  const firstInRound = new Map<number, Json>();
  for (const kill of kills) {
    const round = num(kill.round);
    const existing = firstInRound.get(round);
    if (!existing || num(kill.time_in_round_in_ms) < num(existing.time_in_round_in_ms)) {
      firstInRound.set(round, kill);
    }
  }

  const isolated: string[] = [];

  for (const kill of kills) {
    const killerId = str(asObj(kill.killer).puuid);
    const victimId = str(asObj(kill.victim).puuid);
    if (killerId !== puuid && victimId !== puuid) continue;

    const t = num(kill.time_in_round_in_ms);
    const round = num(kill.round) + 1;
    const weapon = named(kill.weapon);
    const when = bucket(t);
    const first = firstInRound.get(num(kill.round)) === kill;

    if (killerId === puuid) {
      digest.killsByTime[when] += 1;
      digest.killWeapons[weapon] = (digest.killWeapons[weapon] ?? 0) + 1;
      continue;
    }

    digest.deathsByTime[when] += 1;
    digest.deathWeapons[weapon] = (digest.deathWeapons[weapon] ?? 0) + 1;

    const where = point(kill.location);
    const teammates = asArr(kill.player_locations)
      .map(asObj)
      .filter((row) => {
        const player = asObj(row.player);
        if (str(player.puuid) === puuid || str(player.puuid) === killerId) return false;
        const team = str(player.team) || str(player.team_id);
        return !team || team === teamId;
      });
    let nearby = 0;
    if (where) {
      for (const row of teammates) {
        const loc = point(row.location);
        if (loc && dist(where, loc) <= NEARBY) nearby += 1;
      }
    }
    const isolatedDeath = where ? nearby === 0 : false;
    if (isolatedDeath) digest.isolatedDeaths += 1;
    else if (where) digest.supportedDeaths += 1;

    const label = `R${round} ${clock(t)}${first ? " opener" : ""} death to ${weapon}${
      isolatedDeath ? ", no teammate nearby" : nearby ? `, ${nearby} teammate nearby` : ""
    }`;
    if (isolatedDeath && (when === "early" || first)) isolated.push(label);
    else if (!digest.worstDeath) digest.worstDeath = label;
  }

  digest.worstDeath = isolated[0] ?? digest.worstDeath;
  return digest;
}

export function topEntries(counts: Record<string, number>, limit = 3) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => `${name} ×${count}`);
}
