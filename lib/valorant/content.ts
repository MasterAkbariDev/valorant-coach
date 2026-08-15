export type AbilityIcon = {
  slot: string;
  name: string;
  icon: string | null;
};

export type AgentContent = {
  name: string;
  role: string;
  icon: string;
  portrait: string;
  abilities: AbilityIcon[];
};

export type MapContent = {
  name: string;
  icon: string;
  splash: string;
};

export type RankContent = {
  name: string;
  icon: string;
  tier: number;
};

export type ValorantContent = {
  agents: Record<string, AgentContent>;
  maps: Record<string, MapContent>;
  ranks: Record<string, RankContent>;
};

const CONTENT_TTL = 12 * 60 * 60 * 1000;
let cache: { at: number; data: ValorantContent } | null = null;

function keyName(name: string) {
  return name.trim().toLowerCase();
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { next: { revalidate: 43200 } });
  if (!response.ok) throw new Error(`Content API failed (${response.status})`);
  return response.json() as Promise<T>;
}

export async function loadValorantContent(): Promise<ValorantContent> {
  if (cache && Date.now() - cache.at < CONTENT_TTL) return cache.data;

  const [agentsRes, mapsRes, tiersRes] = await Promise.all([
    getJson<{ data: Record<string, unknown>[] }>("https://valorant-api.com/v1/agents?isPlayableCharacter=true"),
    getJson<{ data: Record<string, unknown>[] }>("https://valorant-api.com/v1/maps"),
    getJson<{ data: Record<string, unknown>[] }>("https://valorant-api.com/v1/competitivetiers"),
  ]);

  const agents: Record<string, AgentContent> = {};
  for (const agent of agentsRes.data ?? []) {
    const name = String(agent.displayName ?? "");
    if (!name) continue;
    const role = agent.role as { displayName?: string } | undefined;
    const abilities = Array.isArray(agent.abilities)
      ? (agent.abilities as Record<string, unknown>[])
          .filter((ability) => ability.displayIcon)
          .map((ability) => ({
            slot: String(ability.slot ?? ""),
            name: String(ability.displayName ?? ""),
            icon: typeof ability.displayIcon === "string" ? ability.displayIcon : null,
          }))
      : [];
    agents[keyName(name)] = {
      name,
      role: role?.displayName ?? "Agent",
      icon: String(agent.displayIcon ?? ""),
      portrait: String(agent.fullPortrait ?? agent.displayIcon ?? ""),
      abilities,
    };
  }

  const maps: Record<string, MapContent> = {};
  for (const map of mapsRes.data ?? []) {
    const name = String(map.displayName ?? "");
    if (!name || name === "The Range") continue;
    maps[keyName(name)] = {
      name,
      icon: String(map.listViewIcon ?? map.displayIcon ?? ""),
      splash: String(map.splash ?? map.listViewIcon ?? ""),
    };
  }

  const ranks: Record<string, RankContent> = {};
  const acts = tiersRes.data ?? [];
  const latest = acts[acts.length - 1] as { tiers?: Record<string, unknown>[] } | undefined;
  for (const tier of latest?.tiers ?? []) {
    const name = String(tier.tierName ?? "");
    const icon = String(tier.largeIcon ?? tier.smallIcon ?? "");
    if (!name || !icon || name.toLowerCase() === "unused") continue;
    ranks[keyName(name)] = {
      name,
      icon,
      tier: Number(tier.tier ?? 0),
    };
  }

  cache = { at: Date.now(), data: { agents, maps, ranks } };
  return cache.data;
}

export function lookupAgent(content: ValorantContent | null, name?: string) {
  if (!content || !name) return null;
  return content.agents[keyName(name)] ?? null;
}

export function lookupMap(content: ValorantContent | null, name?: string) {
  if (!content || !name) return null;
  return content.maps[keyName(name)] ?? null;
}

export function lookupRank(content: ValorantContent | null, name?: string) {
  if (!content || !name) return null;
  return (
    content.ranks[keyName(name)] ??
    content.ranks[keyName(name.replace(/unranked/i, "Unrated"))] ??
    null
  );
}
