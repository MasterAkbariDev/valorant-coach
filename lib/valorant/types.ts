import type { CareerSnapshot, MatchDetail, MatchSummary, PlayerIdentity } from "@/types/valorant";

export type HenrikAccount = {
  puuid: string;
  region: string;
  account_level: number;
  name: string;
  tag: string;
  platforms?: string[];
};

export type PlayerBundle = {
  identity: PlayerIdentity;
  account: HenrikAccount | null;
  career: CareerSnapshot | null;
  matches: MatchSummary[];
  details: MatchDetail[];
  source: "henrik" | "none";
  warnings: string[];
};
