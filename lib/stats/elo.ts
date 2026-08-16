export type EloRankMark = {
  name: string;
  elo: number;
  icon: string;
};

export type EloTick = {
  elo: number;
  label: string;
  kind: "major" | "sub";
  icon?: string;
  /** Short copy for the hover card. */
  hint: string;
};

/** Major competitive divisions on Henrik's Elo scale (100 Elo per sub-rank). */
export const ELO_RANKS: EloRankMark[] = [
  { name: "Iron", elo: 0, icon: "Iron 1" },
  { name: "Bronze", elo: 300, icon: "Bronze 1" },
  { name: "Silver", elo: 600, icon: "Silver 1" },
  { name: "Gold", elo: 900, icon: "Gold 1" },
  { name: "Platinum", elo: 1200, icon: "Platinum 1" },
  { name: "Diamond", elo: 1500, icon: "Diamond 1" },
  { name: "Ascendant", elo: 1800, icon: "Ascendant 1" },
  { name: "Immortal", elo: 2100, icon: "Immortal 1" },
  { name: "Radiant", elo: 2400, icon: "Radiant" },
];

/** Timeline ends at Radiant — no empty track past the last rank. */
export const ELO_TRACK_MAX = 2400;

/** Major ranks + Bronze 2 / Bronze 3 style mid ticks (no icons on those). */
export function buildEloTicks(): EloTick[] {
  const ticks: EloTick[] = [];
  for (let i = 0; i < ELO_RANKS.length; i++) {
    const rank = ELO_RANKS[i];
    const isRadiant = rank.name === "Radiant";
    ticks.push({
      elo: rank.elo,
      label: isRadiant ? "Radiant" : `${rank.name} 1`,
      kind: "major",
      icon: rank.icon,
      hint: isRadiant
        ? `Radiant starts at ${rank.elo} Elo. Top of the ladder.`
        : `${rank.name} 1 starts at ${rank.elo} Elo.`,
    });
    if (isRadiant) continue;
    ticks.push({
      elo: rank.elo + 100,
      label: `${rank.name} 2`,
      kind: "sub",
      icon: `${rank.name} 2`,
      hint: `${rank.name} 2 starts at ${rank.elo + 100} Elo.`,
    });
    ticks.push({
      elo: rank.elo + 200,
      label: `${rank.name} 3`,
      kind: "sub",
      icon: `${rank.name} 3`,
      hint: `${rank.name} 3 starts at ${rank.elo + 200} Elo.`,
    });
  }
  return ticks;
}

export function eloToPercent(elo: number) {
  return Math.min(100, Math.max(0, (elo / ELO_TRACK_MAX) * 100));
}

export function eloDivision(elo: number): EloRankMark {
  let current = ELO_RANKS[0];
  for (const rank of ELO_RANKS) {
    if (elo >= rank.elo) current = rank;
  }
  return current;
}

/** Approximate Iron 1 / Bronze 1 / … label from Elo. */
export function eloToRankLabel(elo: number) {
  const division = eloDivision(elo);
  if (division.name === "Radiant") return "Radiant";
  const within = elo - division.elo;
  const sub = Math.min(3, Math.floor(within / 100) + 1);
  return `${division.name} ${sub}`;
}
