import { getHenrikKey } from "@/lib/env";
import { HENRIK_BASE } from "@/lib/valorant/endpoints";
import { HenrikError, pathEncode } from "@/lib/valorant/errors";
import { normalizeMatch } from "@/lib/valorant/normalize";
import { waitForHenrikSlot } from "@/lib/valorant/rate-limit";
import type { HenrikAccount, PlayerBundle } from "@/lib/valorant/types";
import type {
  CareerSnapshot,
  MatchDetail,
  PlayerIdentity,
  RiotRegion,
  RrHistoryEntry,
} from "@/types/valorant";

type HenrikResponse<T> = {
  status?: number;
  data?: T;
  errors?: { message?: string; status?: number }[];
};

type Platform = "pc" | "console";

type CareerHit = {
  career: CareerSnapshot;
  puuid?: string;
  name?: string;
  tag?: string;
};

const CACHE_TTL_MS = 120_000;
const REGIONS: RiotRegion[] = ["eu", "na", "ap", "kr", "latam", "br"];
let bundleCache: { key: string; at: number; bundle: PlayerBundle } | null = null;

function asObj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.matches)) return obj.matches;
    if (Array.isArray(obj.history)) return obj.history;
  }
  return [];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNotFound(error: unknown) {
  return error instanceof HenrikError && error.status === 404;
}

function friendlyHenrikMessage(message: string, status: number) {
  const lower = message.toLowerCase();
  if (status === 429 || lower.includes("rate limit")) {
    return "Too many lookups right now. Wait about a minute and search again.";
  }
  if (lower.includes("play a game") || lower.includes("account level")) {
    return "No Valorant match data for this Riot ID yet. Try the region they actually play on, or wait until they finish a game.";
  }
  return message;
}

function regionOrder(preferred: RiotRegion) {
  return [preferred, ...REGIONS.filter((region) => region !== preferred)];
}

function platformFor(account: HenrikAccount | null): Platform {
  const platforms = (account?.platforms ?? []).map((item) => item.toLowerCase());
  if (platforms.includes("console") && !platforms.includes("pc")) return "console";
  return process.env.RIOT_PLATFORM === "console" ? "console" : "pc";
}

async function henrikGet<T>(path: string, query?: Record<string, string | number | boolean | undefined>) {
  const key = getHenrikKey();
  if (!key) {
    throw new HenrikError(
      "HENRIK_DEV_API_KEY is missing. Get a free VALORANT basic key from the HenrikDev Discord #get-a-key channel.",
      401,
      "missing_key",
    );
  }

  const url = new URL(`${HENRIK_BASE}${path.startsWith("/") ? path : `/${path}`}`);
  if (query) {
    for (const [name, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") url.searchParams.set(name, String(value));
    }
  }

  let lastError: HenrikError | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await waitForHenrikSlot();
    const response = await fetch(url, {
      headers: { Authorization: key, Accept: "application/json" },
      cache: "no-store",
    });
    const json = (await response.json().catch(() => ({}))) as HenrikResponse<T>;
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after"));
      lastError = new HenrikError(
        friendlyHenrikMessage("Rate limit exceeded", 429),
        429,
        "429",
      );
      if (attempt === 0) {
        await sleep((Number.isFinite(retryAfter) ? retryAfter : 2) * 1000);
        continue;
      }
      throw lastError;
    }
    if (!response.ok || (json.status && json.status >= 400)) {
      const raw = json.errors?.[0]?.message || `HenrikDev request failed (${response.status})`;
      throw new HenrikError(
        friendlyHenrikMessage(raw, response.status),
        response.status,
        String(json.errors?.[0]?.status ?? response.status),
      );
    }
    return (json.data ?? json) as T;
  }
  throw lastError ?? new HenrikError(friendlyHenrikMessage("Rate limit exceeded", 429), 429, "429");
}

export async function getAccount(identity: PlayerIdentity): Promise<HenrikAccount | null> {
  try {
    return await henrikGet<HenrikAccount>(`/valorant/v2/account/${pathEncode(identity.name, identity.tag)}`);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

function parseCareerV3(data: Record<string, unknown>): CareerHit {
  const account = asObj(data.account);
  const current = asObj(data.current);
  const peak = asObj(data.peak);
  const tier = asObj(current.tier);
  const peakTier = asObj(peak.tier);
  return {
    career: {
      currentRank: String(tier.name ?? current.currenttierpatched ?? "Unknown"),
      peakRank: String(peakTier.name ?? "Unknown"),
      elo: typeof current.elo === "number" ? current.elo : undefined,
      rankingInTier: typeof current.rr === "number" ? current.rr : undefined,
      lastRrChange: typeof current.last_change === "number" ? current.last_change : undefined,
      wins: 0,
      losses: 0,
      rrHistory: [],
    },
    puuid: typeof account.puuid === "string" ? account.puuid : undefined,
    name: typeof account.name === "string" ? account.name : undefined,
    tag: typeof account.tag === "string" ? account.tag : undefined,
  };
}

async function getCareer(identity: PlayerIdentity, platform: Platform): Promise<CareerHit | null> {
  try {
    const path = identity.puuid
      ? `/valorant/v3/by-puuid/mmr/${pathEncode(identity.region, platform, identity.puuid)}`
      : `/valorant/v3/mmr/${pathEncode(identity.region, platform, identity.name, identity.tag)}`;
    const data = await henrikGet<Record<string, unknown>>(path);
    return parseCareerV3(data);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

function parseHistory(data: unknown): RrHistoryEntry[] {
  return asList(data).map((row) => {
    const item = asObj(row);
    const map = item.map;
    const mapName =
      typeof map === "string"
        ? map
        : map && typeof map === "object"
          ? String(asObj(map).name ?? "Unknown")
          : "Unknown";
    const rr =
      (typeof item.mmr_change === "number" && item.mmr_change) ||
      (typeof item.mmr_change_to_last_game === "number" && item.mmr_change_to_last_game) ||
      (typeof item.last_mmr_change === "number" && item.last_mmr_change) ||
      0;
    return {
      matchId: String(item.match_id ?? ""),
      map: mapName,
      rank: String(item.currenttierpatched ?? ""),
      rrChange: rr,
      date: String(item.date ?? item.date_raw ?? ""),
    };
  });
}

export async function getRrHistory(identity: PlayerIdentity): Promise<RrHistoryEntry[]> {
  try {
    const path = identity.puuid
      ? `/valorant/v1/by-puuid/mmr-history/${pathEncode(identity.region, identity.puuid)}`
      : `/valorant/v1/mmr-history/${pathEncode(identity.region, identity.name, identity.tag)}`;
    return parseHistory(await henrikGet<unknown>(path));
  } catch (error) {
    if (isNotFound(error)) return [];
    throw error;
  }
}

export async function getRecentMatchDetails(
  identity: PlayerIdentity,
  options?: { mode?: string; size?: number; start?: number; platform?: Platform },
): Promise<MatchDetail[]> {
  const platform = options?.platform || platformFor(null);
  const path = identity.puuid
    ? `/valorant/v4/by-puuid/matches/${pathEncode(identity.region, platform, identity.puuid)}`
    : `/valorant/v4/matches/${pathEncode(identity.region, platform, identity.name, identity.tag)}`;
  const data = await henrikGet<unknown>(path, {
    mode: options?.mode,
    size: options?.size ?? 10,
    start: options?.start,
  });
  return asList(data)
    .map((match) => normalizeMatch(match, identity))
    .filter((match): match is MatchDetail => Boolean(match));
}

function attachRr(details: MatchDetail[], history: RrHistoryEntry[]) {
  const byId = new Map(history.filter((row) => row.matchId).map((row) => [row.matchId, row.rrChange]));
  return details.map((detail) => ({
    ...detail,
    rrChange: byId.get(detail.matchId),
  }));
}

async function fetchPlayerBundle(identity: PlayerIdentity): Promise<PlayerBundle> {
  const warnings: string[] = [];
  let account: HenrikAccount | null = null;
  let resolved: PlayerIdentity = { ...identity };

  try {
    account = await getAccount(identity);
    if (account) {
      resolved = {
        ...identity,
        name: account.name || identity.name,
        tag: account.tag || identity.tag,
        region: (account.region as RiotRegion) || identity.region,
        puuid: account.puuid,
      };
    }
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Account lookup failed");
  }

  let platform = platformFor(account);
  let careerHit: CareerHit | null = null;
  try {
    careerHit = await getCareer(resolved, platform);
    if (!careerHit && !account) {
      for (const region of regionOrder(identity.region).slice(1)) {
        careerHit = await getCareer({ ...resolved, region }, platform);
        if (careerHit) {
          resolved = { ...resolved, region };
          break;
        }
      }
    }
    if (!careerHit && platform === "pc") {
      careerHit = await getCareer(resolved, "console");
      if (careerHit) platform = "console";
    }
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Rank lookup failed");
  }

  if (careerHit?.puuid) resolved = { ...resolved, puuid: careerHit.puuid };
  if (careerHit?.name) resolved = { ...resolved, name: careerHit.name };
  if (careerHit?.tag) resolved = { ...resolved, tag: careerHit.tag };

  let career = careerHit?.career ?? null;
  let rrHistory: RrHistoryEntry[] = [];
  let details: MatchDetail[] = [];

  const [historyResult, matchResult] = await Promise.allSettled([
    getRrHistory(resolved),
    getRecentMatchDetails(resolved, { mode: "competitive", size: 10, platform }),
  ]);

  if (historyResult.status === "fulfilled") rrHistory = historyResult.value;
  else warnings.push(historyResult.reason instanceof Error ? historyResult.reason.message : "RR history lookup failed");

  if (matchResult.status === "fulfilled") details = matchResult.value;
  else warnings.push(matchResult.reason instanceof Error ? matchResult.reason.message : "Match lookup failed");

  if (!details.length) {
    try {
      details = await getRecentMatchDetails(resolved, { size: 10, platform });
      if (details.length) warnings.push("No recent competitive games found, so this review includes other modes.");
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Match lookup failed");
    }
  }

  details = attachRr(details, rrHistory);
  if (career) {
    career = {
      ...career,
      rrHistory,
      wins: details.filter((match) => match.result === "win").length,
      losses: details.filter((match) => match.result === "loss").length,
    };
  }

  if (!account && !career && !details.length) {
    const detail = warnings[0] || "No Valorant data for that Riot ID.";
    throw new HenrikError(detail, 404, "not_found");
  }

  return {
    identity: resolved,
    account,
    career,
    matches: details,
    details,
    source: details.length || account || career ? "henrik" : "none",
    warnings,
  };
}

export async function loadPlayerBundle(identity: PlayerIdentity, options?: { refresh?: boolean }) {
  const cacheKey = `${identity.name}#${identity.tag}:${identity.region}`.toLowerCase();
  if (!options?.refresh && bundleCache && bundleCache.key === cacheKey && Date.now() - bundleCache.at < CACHE_TTL_MS) {
    return bundleCache.bundle;
  }
  if (!getHenrikKey()) {
    return {
      identity,
      account: null,
      career: null,
      matches: [],
      details: [],
      source: "none" as const,
      warnings: [
        "HENRIK_DEV_API_KEY is missing. Get a free VALORANT basic key from the HenrikDev Discord #get-a-key channel.",
      ],
    };
  }
  const bundle = await fetchPlayerBundle(identity);
  bundleCache = { key: cacheKey, at: Date.now(), bundle };
  return bundle;
}
