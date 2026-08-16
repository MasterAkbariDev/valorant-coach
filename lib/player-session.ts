import type { MatchAdvice } from "@/types/analysis";
import type { CareerSnapshot, MatchSummary, PlayerIdentity } from "@/types/valorant";
import type { RankedInsights } from "@/lib/stats/aggregate";

export const PLAYER_FRESH_MS = 2 * 60 * 1000;
export const THEME_KEY = "valorant-coach:theme";
export const LAST_PLAYER_KEY = "valorant-coach:last-player";
export const SESSION_PREFIX = "valorant-coach:session:";

export type ThemeId = "crimson" | "ion" | "protocol" | "radiant";

export type MatchRow = MatchSummary & {
  economy?: unknown;
  damageDealt?: unknown;
  damageReceived?: unknown;
};

export type MatchesPayload = {
  ok: boolean;
  fetchedAt?: number;
  error?: string;
  config?: {
    riotName: string;
    riotTag: string;
    riotRegion: string;
    hasGeminiKey: boolean;
    hasCoachAi?: boolean;
    hasHenrikKey: boolean;
  };
  identity?: PlayerIdentity;
  account?: { account_level?: number; puuid?: string } | null;
  career?: CareerSnapshot | null;
  insights?: RankedInsights;
  matches?: MatchRow[];
  warnings?: string[];
  source?: string;
};

export type AnalyzePayload = {
  ok: boolean;
  fetchedAt?: number;
  error?: string;
  advice?: MatchAdvice;
  matchCount?: number;
  /** True when the server returned stored notes without a new AI call. */
  cached?: boolean;
  generatedAt?: number;
};

export type PlayerSession = {
  riotId: string;
  region: string;
  fetchedAt: number;
  matches: MatchesPayload;
  advice: AnalyzePayload | null;
};

export function sessionKey(name: string, tag: string, region: string) {
  return `${SESSION_PREFIX}${name}#${tag}:${region}`.toLowerCase();
}

export function readSession(name: string, tag: string, region: string): PlayerSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(sessionKey(name, tag, region));
    if (!raw) return null;
    return JSON.parse(raw) as PlayerSession;
  } catch {
    return null;
  }
}

export function writeSession(session: PlayerSession) {
  const parsed = session.riotId.includes("#")
    ? session.riotId
    : `${session.matches.identity?.name ?? ""}#${session.matches.identity?.tag ?? ""}`;
  const hash = parsed.lastIndexOf("#");
  const name = hash >= 0 ? parsed.slice(0, hash) : parsed;
  const tag = hash >= 0 ? parsed.slice(hash + 1) : "";
  localStorage.setItem(sessionKey(name, tag, session.region), JSON.stringify(session));
  localStorage.setItem(
    LAST_PLAYER_KEY,
    JSON.stringify({ riotId: session.riotId, region: session.region }),
  );
}

export function sessionIsFresh(session: PlayerSession | null, now = Date.now()) {
  if (!session?.fetchedAt) return false;
  return now - session.fetchedAt < PLAYER_FRESH_MS;
}

export function remainingMs(session: PlayerSession | null, now = Date.now()) {
  if (!session?.fetchedAt) return 0;
  return Math.max(0, PLAYER_FRESH_MS - (now - session.fetchedAt));
}
