import type { PlayerIdentity, RiotRegion } from "@/types/valorant";

const REGIONS: RiotRegion[] = ["eu", "na", "ap", "kr", "latam", "br"];

function cleanPart(value: string) {
  return value.normalize("NFC").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
}

export function parseRiotId(raw: string) {
  const trimmed = cleanPart(raw);
  const hash = trimmed.lastIndexOf("#");
  if (hash <= 0 || hash === trimmed.length - 1) {
    return { name: trimmed, tag: "" };
  }
  return {
    name: cleanPart(trimmed.slice(0, hash)),
    tag: cleanPart(trimmed.slice(hash + 1)),
  };
}

export function formatRiotId(name: string, tag: string) {
  return tag ? `${name}#${tag}` : name;
}

export function isRiotRegion(value: string): value is RiotRegion {
  return REGIONS.includes(value as RiotRegion);
}

export function parseIdentity(input: {
  riotId?: string | null;
  name?: string | null;
  tag?: string | null;
  region?: string | null;
}): PlayerIdentity | null {
  const parsed = input.riotId ? parseRiotId(input.riotId) : { name: input.name ?? "", tag: input.tag ?? "" };
  const name = cleanPart(parsed.name);
  const tag = cleanPart(parsed.tag);
  if (!name || !tag) return null;
  const rawRegion = input.region ?? "eu";
  const region = isRiotRegion(rawRegion) ? rawRegion : "eu";
  return { name, tag, region };
}

export { REGIONS };
