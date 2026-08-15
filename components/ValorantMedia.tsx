import type { CSSProperties } from "react";
import { lookupAgent, lookupMap, lookupRank, type AbilityIcon, type ValorantContent } from "@/lib/valorant/content";

function Media({
  src,
  alt,
  className,
  style,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (!src) {
    return <span className={`inline-block rounded-md bg-white/8 ${className ?? ""}`} style={style} />;
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

export function AgentPortrait({
  content,
  name,
  className,
  size = 40,
}: {
  content: ValorantContent | null;
  name?: string;
  className?: string;
  size?: number;
}) {
  const agent = lookupAgent(content, name);
  return (
    <Media
      src={agent?.icon}
      alt={name ?? "Agent"}
      className={className ?? "rounded-lg object-cover"}
      style={{ width: size, height: size }}
    />
  );
}

export function RankIcon({
  content,
  name,
  className,
  size = 72,
}: {
  content: ValorantContent | null;
  name?: string;
  className?: string;
  size?: number;
}) {
  const rank = lookupRank(content, name);
  return (
    <Media
      src={rank?.icon}
      alt={name ?? "Rank"}
      className={className ?? "object-contain"}
      style={{ width: size, height: size }}
    />
  );
}

export function MapThumb({
  content,
  name,
  className,
}: {
  content: ValorantContent | null;
  name?: string;
  className?: string;
}) {
  const map = lookupMap(content, name);
  return (
    <Media
      src={map?.icon || map?.splash}
      alt={name ?? "Map"}
      className={className ?? "h-8 w-[4.5rem] rounded object-cover"}
    />
  );
}

const SLOT_LABEL: Record<string, string> = {
  Ability1: "C",
  Ability2: "Q",
  Grenade: "E",
  Ultimate: "X",
};

export function AbilityCasts({
  content,
  agentName,
  casts,
}: {
  content: ValorantContent | null;
  agentName: string;
  casts?: {
    ability1?: number | null;
    ability2?: number | null;
    grenade?: number | null;
    ultimate?: number | null;
  };
}) {
  const agent = lookupAgent(content, agentName);
  const bySlot: Record<string, number> = {
    Ability1: Math.round((casts?.ability1 ?? 0) * 10) / 10,
    Ability2: Math.round((casts?.ability2 ?? 0) * 10) / 10,
    Grenade: Math.round((casts?.grenade ?? 0) * 10) / 10,
    Ultimate: Math.round((casts?.ultimate ?? 0) * 10) / 10,
  };
  const abilities: AbilityIcon[] = agent?.abilities?.length
    ? agent.abilities.filter((ability) => ability.slot in bySlot)
    : [
        { slot: "Ability1", name: "C", icon: null },
        { slot: "Ability2", name: "Q", icon: null },
        { slot: "Grenade", name: "E", icon: null },
        { slot: "Ultimate", name: "X", icon: null },
      ];

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {abilities.map((ability) => (
        <span
          key={ability.slot}
          title={`${ability.name} (${SLOT_LABEL[ability.slot] ?? ability.slot})`}
          className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)]"
        >
          {ability.icon ? (
            <img src={ability.icon} alt={ability.name} className="h-4 w-4 object-contain opacity-90" />
          ) : (
            <span className="font-mono text-[10px]">{SLOT_LABEL[ability.slot] ?? "?"}</span>
          )}
          {bySlot[ability.slot]}
        </span>
      ))}
    </div>
  );
}

export function agentRole(content: ValorantContent | null, name?: string) {
  return lookupAgent(content, name)?.role ?? null;
}
