import type { RiotRegion } from "@/types/valorant";

export const REGION_OPTIONS: { id: RiotRegion; label: string; hint: string }[] = [
  { id: "eu", label: "Europe", hint: "EU servers" },
  { id: "na", label: "North America", hint: "US & Canada" },
  { id: "ap", label: "Asia-Pacific", hint: "SE Asia, Oceania, South Asia" },
  { id: "kr", label: "Korea", hint: "South Korea" },
  { id: "latam", label: "Latin America", hint: "LATAM servers" },
  { id: "br", label: "Brazil", hint: "Brazil servers" },
];

export function regionLabel(id?: string) {
  return REGION_OPTIONS.find((item) => item.id === id)?.label ?? id?.toUpperCase() ?? "Unknown region";
}
