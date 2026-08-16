export type RiotRegion = "eu" | "na" | "ap" | "kr" | "latam" | "br";

export type PlayerIdentity = {
  name: string;
  tag: string;
  region: RiotRegion;
  puuid?: string;
};

export type MatchSummary = {
  matchId: string;
  map: string;
  mode: string;
  queue: string;
  startedAt: string;
  result: "win" | "loss" | "draw" | "unknown";
  agent: string;
  kills: number;
  deaths: number;
  assists: number;
  acs: number;
  headshotPercent: number;
  firstBloods: number;
  firstDeaths: number;
  rrChange?: number;
  agentId?: string;
  abilityCasts?: {
    ability1?: number | null;
    ability2?: number | null;
    grenade?: number | null;
    ultimate?: number | null;
  };
  roundsWon?: number;
  roundsLost?: number;
  adr?: number;
  damageDealt?: number;
  damageReceived?: number;
  plants?: number;
  tradedDeaths?: number;
  untradedDeaths?: number;
  earlyFirstDeaths?: number;
  afkRounds?: number;
  roundsInSpawn?: number;
  spentAvg?: number;
  loadoutAvg?: number;
  timeline?: {
    isolatedDeaths: number;
    supportedDeaths: number;
    deathWeapons: Record<string, number>;
    killWeapons: Record<string, number>;
    deathsByTime: { early: number; mid: number; late: number };
    killsByTime: { early: number; mid: number; late: number };
    worstDeath: string | null;
    multiKillRounds: number;
    bestRoundKills: number;
  };
};

export type MatchDetail = MatchSummary & {
  rounds: unknown[];
  killsTimeline: unknown[];
  economy: unknown;
  raw: unknown;
};

export type RrHistoryEntry = {
  matchId: string;
  map: string;
  rank: string;
  rrChange: number;
  date: string;
};

export type CareerSnapshot = {
  currentRank: string;
  peakRank: string;
  elo?: number;
  rankingInTier?: number;
  lastRrChange?: number;
  wins: number;
  losses: number;
  rrHistory: RrHistoryEntry[];
};
