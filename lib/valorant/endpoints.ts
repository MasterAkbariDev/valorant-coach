/**
 * HenrikDev unofficial VALORANT API.
 * Docs: https://docs.henrikdev.xyz
 * Auth: Authorization header (free key from their Discord #get-a-key).
 */
export const HENRIK_BASE = "https://api.henrikdev.xyz";

export const valorantEndpoints = {
  account: "/valorant/v2/account/{name}/{tag}",
  mmr: "/valorant/v2/mmr/{region}/{name}/{tag}",
  mmrHistory: "/valorant/v1/mmr-history/{region}/{name}/{tag}",
  matchesV4: "/valorant/v4/matches/{region}/{platform}/{name}/{tag}",
  matchByIdV4: "/valorant/v4/match/{region}/{platform}/{matchId}",
  storedMatches: "/valorant/v1/stored-matches/{region}/{name}/{tag}",
} as const;
