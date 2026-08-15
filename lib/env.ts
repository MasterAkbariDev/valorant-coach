import type { PlayerIdentity, RiotRegion } from "@/types/valorant";

const REGIONS: RiotRegion[] = ["eu", "na", "ap", "kr", "latam", "br"];

export function geminiKeys() {
  const numbered = [2, 3, 4, 5, 6, 7, 8].map((index) => process.env[`GEMINI_API_KEY_${index}`]?.trim());
  const listed = (process.env.GEMINI_API_KEYS ?? "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set([process.env.GEMINI_API_KEY?.trim(), ...numbered, ...listed].filter(Boolean) as string[])];
}

export function getPublicConfig() {
  const keys = geminiKeys();
  const hasGeminiKey = keys.length > 0;
  const hasCoachAi = Boolean(
    hasGeminiKey ||
      process.env.GROQ_API_KEY?.trim() ||
      process.env.CEREBRAS_API_KEY?.trim() ||
      process.env.OPENROUTER_API_KEY?.trim() ||
      process.env.MISTRAL_API_KEY?.trim(),
  );
  return {
    riotName: process.env.RIOT_NAME ?? "",
    riotTag: process.env.RIOT_TAG ?? "",
    riotRegion: (process.env.RIOT_REGION as RiotRegion) || "eu",
    riotPlatform: process.env.RIOT_PLATFORM || "pc",
    hasGeminiKey,
    hasCoachAi,
    hasHenrikKey: Boolean(process.env.HENRIK_DEV_API_KEY),
    geminiModel: process.env.GEMINI_MODEL || "gemini-3.6-flash",
  };
}

export function getPlayerIdentity(): PlayerIdentity {
  const name = process.env.RIOT_NAME?.trim();
  const tag = process.env.RIOT_TAG?.trim();
  if (!name || !tag) {
    throw new Error("RIOT_NAME and RIOT_TAG must be set in .env.local");
  }
  const region = (process.env.RIOT_REGION as RiotRegion) || "eu";
  return {
    name,
    tag,
    region: REGIONS.includes(region) ? region : "eu",
  };
}

export function resolveIdentity(input?: {
  name?: string | null;
  tag?: string | null;
  region?: string | null;
}): PlayerIdentity {
  const fallback = getPlayerIdentity();
  const name = input?.name?.trim() || fallback.name;
  const tag = input?.tag?.trim() || fallback.tag;
  const regionRaw = (input?.region?.trim() || fallback.region) as RiotRegion;
  return {
    name,
    tag,
    region: REGIONS.includes(regionRaw) ? regionRaw : fallback.region,
  };
}

export function requireGeminiKey() {
  const key = geminiKeys()[0];
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set. Add it to .env.local");
  }
  return key;
}

export function getHenrikKey() {
  return process.env.HENRIK_DEV_API_KEY?.trim() || "";
}

export function redactSecrets(message: string) {
  return message
    .replace(/AQ\.[A-Za-z0-9_-]+/g, "AQ.[redacted]")
    .replace(/AIza[A-Za-z0-9_-]+/g, "AIza[redacted]")
    .replace(/HDEV-[A-Za-z0-9-]+/gi, "HDEV-[redacted]")
    .replace(/gsk_[A-Za-z0-9]+/g, "gsk_[redacted]")
    .replace(/sk-or-v1-[A-Za-z0-9]+/g, "sk-or-[redacted]")
    .replace(/csk-[A-Za-z0-9]+/g, "csk-[redacted]");
}
