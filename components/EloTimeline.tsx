"use client";

import { RankIcon } from "@/components/ValorantMedia";
import {
  buildEloTicks,
  eloDivision,
  eloToPercent,
  eloToRankLabel,
  type EloTick,
} from "@/lib/stats/elo";
import type { ValorantContent } from "@/lib/valorant/content";

const TICKS = buildEloTicks();

function EloHoverCard({
  tick,
  content,
}: {
  tick: EloTick;
  content: ValorantContent | null;
}) {
  const iconName = tick.icon || tick.label;
  return (
    <span className="elo-tip" role="tooltip">
      <span className="elo-tip-top">
        <span className="elo-tip-icon">
          <RankIcon content={content} name={iconName} size={36} />
        </span>
        <span className="elo-tip-copy">
          <span className="elo-tip-rank">{tick.label}</span>
          <span className="elo-tip-elo display">{tick.elo}</span>
          <span className="elo-tip-unit">Elo to reach</span>
        </span>
      </span>
      <span className="elo-tip-hint">{tick.hint}</span>
    </span>
  );
}

export default function EloTimeline({
  elo,
  currentRank,
  content,
}: {
  elo?: number | null;
  currentRank?: string | null;
  content: ValorantContent | null;
}) {
  if (elo == null || !Number.isFinite(elo)) {
    return (
      <section className="glass rounded-2xl p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent)]">Competitive Elo</p>
        <h3 className="display mt-1 text-2xl font-semibold">Elo timeline</h3>
        <p className="mt-3 text-sm text-[var(--muted)]">No Elo yet for this account — play a few ranked games and refresh.</p>
      </section>
    );
  }

  const fill = eloToPercent(elo);
  const division = eloDivision(elo);
  const approx = eloToRankLabel(elo);
  const atRadiant = elo >= 2400;
  const markerLeft = `${fill}%`;

  return (
    <section className="glass fade-up elo-section rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent)]">Competitive Elo</p>
          <h3 className="display mt-1 text-2xl font-semibold">Elo timeline</h3>
        </div>
        <div className="elo-hero-score flex items-center gap-3">
          <span className="elo-hero-icon">
            <RankIcon content={content} name={currentRank || approx} size={44} />
          </span>
          <div className="text-right">
            <p className="display elo-hero-number text-3xl font-semibold leading-none tabular-nums">{elo}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {currentRank || approx}
              {atRadiant ? " · top of the track" : ` · ~${division.name}`}
            </p>
          </div>
        </div>
      </div>

      <div className="elo-track-wrap mt-6">
        <div className="elo-track">
          <div className="elo-track-sheen" aria-hidden="true" />
          <div className="elo-track-fill" style={{ ["--elo-fill" as string]: markerLeft }} />

          <div className="elo-ticks">
            {TICKS.map((tick) => {
              const hit = elo >= tick.elo;
              const isStart = tick.elo <= 0;
              const isEnd = tick.elo >= 2400;
              return (
                <button
                  key={`${tick.label}-${tick.elo}`}
                  type="button"
                  className={[
                    "elo-tick",
                    `elo-tick-${tick.kind}`,
                    hit ? "elo-tick-hit" : "",
                    isStart ? "elo-tick-start" : "",
                    isEnd ? "elo-tick-end" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ left: `${eloToPercent(tick.elo)}%` }}
                  aria-label={`${tick.label}, ${tick.elo} Elo`}
                >
                  <span className="elo-tick-mark" />
                  {tick.kind === "major" ? (
                    <span className="elo-tick-badge" aria-hidden="true">
                      <RankIcon content={content} name={tick.icon || tick.label} size={18} />
                    </span>
                  ) : null}
                  <EloHoverCard tick={tick} content={content} />
                </button>
              );
            })}
          </div>

          <span
            className="elo-marker"
            style={{ ["--elo-marker" as string]: markerLeft }}
            aria-hidden="true"
          />
        </div>
      </div>

      <p className="elo-desc mt-4 max-w-3xl text-sm leading-6 text-[var(--muted)]">
        Elo is Henrik&apos;s single number for your competitive standing: each sub-rank is 100 Elo, and your RR
        fills the rest (e.g. Ascendant 1 at 22 RR ≈ 1822). Tall ticks with icons are division starts (Iron 1,
        Bronze 1…); the two shorter ticks between them are that rank&apos;s II and III. Hover any tick for the
        Elo needed. The track ends at Radiant.
      </p>
    </section>
  );
}
