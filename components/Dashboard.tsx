"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppHeader, { applyTheme } from "@/components/AppHeader";
import CoachLoading, { SearchLoading } from "@/components/CoachLoading";
import { AbilityCasts, AgentPortrait, MapThumb, RankIcon, agentRole } from "@/components/ValorantMedia";
import { useValorantContent } from "@/hooks/useValorantContent";
import { adviceIsUsable } from "@/lib/gemini/advice";
import { regionLabel, REGION_OPTIONS } from "@/lib/regions";
import {
  LAST_PLAYER_KEY,
  PLAYER_FRESH_MS,
  THEME_KEY,
  readSession,
  sessionIsFresh,
  writeSession,
  type AnalyzePayload,
  type MatchesPayload,
  type PlayerSession,
  type ThemeId,
} from "@/lib/player-session";
import { formatRiotId, parseRiotId } from "@/lib/riot-id";
import type { ValorantContent } from "@/lib/valorant/content";

function formatAge(fetchedAt: number, now: number) {
  const seconds = Math.max(0, Math.floor((now - fetchedAt) / 1000));
  if (seconds < 20) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function rrColor(value?: number | null) {
  if (value == null) return "var(--muted)";
  if (value > 0) return "var(--good)";
  if (value < 0) return "var(--bad)";
  return "var(--muted)";
}

const STATS: {
  key: string;
  label: string;
  hint: string;
  value: (matches: MatchesPayload) => string;
}[] = [
  {
    key: "wr",
    label: "Win rate",
    hint: "Wins in this sample",
    value: (matches) => `${matches.insights?.winRate ?? 0}%`,
  },
  {
    key: "kd",
    label: "Kills / death",
    hint: "Kills divided by deaths",
    value: (matches) => String(matches.insights?.kd ?? 0),
  },
  {
    key: "acs",
    label: "Combat score",
    hint: "Average combat score per round",
    value: (matches) => String(matches.insights?.avgAcs ?? 0),
  },
  {
    key: "hs",
    label: "Headshot %",
    hint: "Headshots vs all shots landed",
    value: (matches) => `${matches.insights?.avgHeadshotPercent ?? 0}%`,
  },
  {
    key: "open",
    label: "Openers",
    hint: "First kills vs first deaths",
    value: (matches) =>
      `${matches.insights?.firstBloods ?? 0} / ${matches.insights?.firstDeaths ?? 0}`,
  },
  {
    key: "rr",
    label: "Net rank rating",
    hint: "RR gained or lost in this sample",
    value: (matches) => {
      const net = matches.insights?.netRr ?? 0;
      return net > 0 ? `+${net}` : String(net);
    },
  },
];

const SEVERITY: Record<string, { label: string; color: string }> = {
  critical: { label: "Rank leak", color: "var(--bad)" },
  improve: { label: "Next games", color: "var(--warn)" },
  keep: { label: "Keep this", color: "var(--good)" },
};

export default function Dashboard() {
  const content = useValorantContent();
  const [theme, setTheme] = useState<ThemeId>("crimson");
  const [riotId, setRiotId] = useState("not HIM#8585");
  const [region, setRegion] = useState("eu");
  const [matches, setMatches] = useState<MatchesPayload | null>(null);
  const [advice, setAdvice] = useState<AnalyzePayload | null>(null);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [coaching, setCoaching] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_KEY) as ThemeId | null;
    if (storedTheme) {
      setTheme(storedTheme);
      applyTheme(storedTheme);
    }
    const last = localStorage.getItem(LAST_PLAYER_KEY);
    let nextId = riotId;
    let nextRegion = region;
    if (last) {
      try {
        const parsed = JSON.parse(last) as { riotId?: string; region?: string };
        if (parsed.riotId) nextId = parsed.riotId;
        if (parsed.region) nextRegion = parsed.region;
      } catch {
        /* ignore */
      }
    }
    setRiotId(nextId);
    setRegion(nextRegion);
    const parsed = parseRiotId(nextId);
    if (parsed.name && parsed.tag) {
      const session = readSession(parsed.name, parsed.tag, nextRegion);
      if (session) {
        applySession(session, true);
        setMatchesLoading(false);
        if (!sessionIsFresh(session)) void searchPlayer(nextId, nextRegion, false);
        return;
      }
      void searchPlayer(nextId, nextRegion, false);
      return;
    }
    setMatchesLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const applySession = (session: PlayerSession, cached: boolean) => {
    setMatches(session.matches);
    const stored = session.advice;
    setAdvice(stored?.ok && !adviceIsUsable(stored.advice) ? null : stored);
    setFromCache(cached);
    setFetchedAt(session.fetchedAt);
  };

  const searchPlayer = useCallback(async (id: string, nextRegion: string, force: boolean) => {
    const parsed = parseRiotId(id);
    if (!parsed.name || !parsed.tag) {
      setError("Use Riot ID as Name#Tag, for example TenZ#NA1.");
      setMatchesLoading(false);
      return;
    }
    setError("");
    const cached = readSession(parsed.name, parsed.tag, nextRegion);
    if (!force && sessionIsFresh(cached)) {
      applySession(cached!, true);
      setMatchesLoading(false);
      setCoaching(false);
      return;
    }

    try {
      setFromCache(false);
      setMatchesLoading(true);
      const matchRes = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: parsed.name,
          tag: parsed.tag,
          region: nextRegion,
          refresh: force,
        }),
        cache: "no-store",
      });
      const matchJson = (await matchRes.json()) as MatchesPayload;
      setMatches(matchJson);
      setMatchesLoading(false);
      if (!matchJson.ok) {
        setCoaching(false);
        setError(matchJson.error || "Could not load that player.");
        return;
      }

      const at = matchJson.fetchedAt ?? Date.now();
      setFetchedAt(at);

      let nextAdvice: AnalyzePayload | null = cached?.advice ?? null;
      if ((matchJson.config?.hasCoachAi ?? matchJson.config?.hasGeminiKey) && (matchJson.matches?.length ?? 0) > 0) {
        setCoaching(true);
        if (!force && cached?.advice?.ok && adviceIsUsable(cached.advice.advice)) {
          setAdvice(cached.advice);
        }
        const analyzeRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: parsed.name,
            tag: parsed.tag,
            region: nextRegion,
            refresh: false,
          }),
        });
        nextAdvice = (await analyzeRes.json()) as AnalyzePayload;
        const incomingUsable = nextAdvice.ok && adviceIsUsable(nextAdvice.advice);
        const previousUsable = Boolean(cached?.advice?.ok && adviceIsUsable(cached.advice?.advice));
        if (incomingUsable) {
          setAdvice(nextAdvice);
        } else if (previousUsable && cached?.advice) {
          setAdvice({
            ...cached.advice,
            error: "Gemini didn't return new notes. Showing your last good notes.",
          });
          nextAdvice = cached.advice;
        } else {
          setAdvice(nextAdvice);
        }
        setCoaching(false);
      } else {
        nextAdvice = null;
        setAdvice(null);
        setCoaching(false);
      }

      const session: PlayerSession = {
        riotId: formatRiotId(matchJson.identity?.name ?? parsed.name, matchJson.identity?.tag ?? parsed.tag),
        region: matchJson.identity?.region ?? nextRegion,
        fetchedAt: at,
        matches: matchJson,
        advice: nextAdvice,
      };
      writeSession(session);
    } catch (err) {
      setMatchesLoading(false);
      setCoaching(false);
      setError(err instanceof Error ? err.message : "Search failed");
    }
  }, []);

  const player = matches?.identity
    ? formatRiotId(matches.identity.name, matches.identity.tag)
    : riotId;
  const rankName = matches?.career?.currentRank ?? "Unranked";
  const rr = matches?.career?.rankingInTier;
  const lastRr = matches?.career?.lastRrChange;
  const mainAgent = matches?.insights?.mainAgent;

  const agentEntries = useMemo(
    () => Object.entries(matches?.insights?.agentWinRates ?? {}).sort((a, b) => b[1].games - a[1].games),
    [matches],
  );
  const mapEntries = useMemo(
    () => Object.entries(matches?.insights?.mapWinRates ?? {}).sort((a, b) => b[1].games - a[1].games),
    [matches],
  );

  const selectedRegion = REGION_OPTIONS.find((item) => item.id === region);
  const dimming = matchesLoading || coaching;

  return (
    <div className="app-shell">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-5 py-8 sm:px-8 sm:py-10">
        <AppHeader
          theme={theme}
          active="ranked"
          onTheme={(next) => {
            setTheme(next);
            applyTheme(next);
          }}
        />

        <form
          className="glass fade-up rounded-2xl p-3 sm:p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void searchPlayer(riotId, region, false);
          }}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Riot ID</span>
              <input
                value={riotId}
                onChange={(event) => setRiotId(event.target.value)}
                placeholder="Riot ID  ·  Name#Tag"
                className="search-control w-full"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className="sm:w-56">
              <span className="sr-only">Server region</span>
              <select
                value={region}
                onChange={(event) => setRegion(event.target.value)}
                className="search-control w-full"
              >
                {REGION_OPTIONS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={matchesLoading}
              className="btn-primary search-control sm:w-32"
            >
              {matchesLoading ? "Loading…" : "Search"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--muted)]">
            {fetchedAt ? (
              <span>
                {fromCache ? "Saved profile" : "Live profile"} · updated {formatAge(fetchedAt, now)}
                {now - fetchedAt > PLAYER_FRESH_MS ? " · older than 2 minutes" : ""}
              </span>
            ) : (
              <span>
                {selectedRegion
                  ? `Searching ${selectedRegion.label} (${selectedRegion.hint}).`
                  : "Enter a Riot ID, pick their server, then search."}
              </span>
            )}
            {matches?.ok ? (
              <button
                type="button"
                className="text-[var(--text)] underline decoration-[var(--accent)] underline-offset-4"
                onClick={() => void searchPlayer(riotId, region, true)}
              >
                Refresh now
              </button>
            ) : null}
          </div>
        </form>

        {error ? (
          <p className="rounded-2xl border border-[var(--bad)]/40 bg-[color-mix(in_srgb,var(--bad)_12%,transparent)] px-4 py-3 text-[var(--bad)]">
            {error}
          </p>
        ) : null}

        {matchesLoading && matches?.ok ? (
          <div className="refresh-strip fade-up">
            <div className="coach-orb" style={{ width: 28, height: 28 }} aria-hidden="true" />
            <span>Updating {riotId}…</span>
            <div className="ml-auto h-1.5 w-36 overflow-hidden rounded-full bg-white/10">
              <div className="coach-bar h-full w-2/3 rounded-full" />
            </div>
          </div>
        ) : null}

        {matchesLoading && !matches?.ok ? <SearchLoading riotId={riotId} /> : null}

        {matches?.ok ? (
          <>
            <div className={`flex flex-col gap-7 ${dimming ? "content-dim" : ""}`}>
            <section className="hero-card glass fade-up rounded-2xl">
              <div className="flex flex-wrap items-center gap-5 p-5 sm:p-6">
                <div className="hero-glow">
                  <RankIcon content={content} name={rankName} size={92} />
                </div>
                <div className="min-w-[16rem] flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    {mainAgent ? <AgentPortrait content={content} name={mainAgent} size={40} /> : null}
                    <h2 className="display text-3xl font-semibold tracking-tight sm:text-4xl">{player}</h2>
                  </div>
                  <p className="mt-2 text-[var(--muted)]">
                    {rankName}
                    {` · ${regionLabel(matches.identity?.region)}`}
                    {matches.account?.account_level ? ` · Level ${matches.account.account_level}` : ""}
                    {matches.insights?.sampleSize
                      ? ` · last ${matches.insights.sampleSize} competitive games`
                      : " · no recent competitive games in this sample"}
                  </p>
                  {rr != null ? (
                    <div className="mt-4 max-w-md">
                      <div className="mb-2 flex items-end justify-between gap-3">
                        <p className="rr-value display text-3xl font-semibold leading-none">
                          {rr}
                          <span className="text-lg text-[var(--muted)]"> / 100</span>
                        </p>
                        <span className="text-sm" style={{ color: rrColor(lastRr) }}>
                          Last game {lastRr == null ? "—" : lastRr > 0 ? `+${lastRr}` : lastRr} RR
                        </span>
                      </div>
                      <div className="rr-track">
                        <div className="rr-fill" style={{ width: `${Math.min(100, Math.max(0, rr))}%` }} />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              {STATS.map((stat) => (
                <article key={stat.key} className="glass glass-hover rounded-2xl p-4">
                  <p className="text-xs font-medium text-[var(--muted)]">{stat.label}</p>
                  <p className="display mt-1 text-3xl font-semibold">{stat.value(matches)}</p>
                  <p className="stat-hint mt-1">{stat.hint}</p>
                </article>
              ))}
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <PoolCard
                title="Agents"
                empty="No agent sample yet."
                content={content}
                kind="agent"
                rows={agentEntries.map(([name, stats]) => ({
                  name,
                  games: stats.games,
                  winRate: stats.winRate,
                  avgAcs: stats.avgAcs,
                  casts: matches.insights?.abilityAverages[name],
                }))}
              />
              <PoolCard
                title="Maps"
                empty="No map sample yet."
                content={content}
                kind="map"
                rows={mapEntries.map(([name, stats]) => ({
                  name,
                  games: stats.games,
                  winRate: stats.winRate,
                  avgAcs: stats.avgAcs,
                }))}
              />
            </section>
            </div>

            <section className="space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent)]">Coach notes</p>
                  <h3 className="display text-2xl font-semibold">What to do next</h3>
                </div>
                {!coaching && fromCache && advice?.ok ? (
                  <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">
                    Saved notes
                  </span>
                ) : null}
              </div>
              {advice?.error ? (
                <p className={advice.ok ? "text-[var(--warn)]" : "text-[var(--bad)]"}>{advice.error}</p>
              ) : null}
              {coaching ? <CoachLoading /> : null}
              {coaching && advice?.advice ? (
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Previous notes while Gemini writes</p>
              ) : null}
              {advice?.advice ? (
                <div className={`space-y-3 ${dimming ? "content-dim" : ""}`}>
                  <p className="glass rounded-2xl p-5 text-base leading-7">{advice.advice.summary}</p>
                  <div className="grid gap-3">
                    {advice.advice.items.map((item) => {
                      const severity = SEVERITY[item.severity] ?? SEVERITY.improve;
                      return (
                        <article
                          key={item.title}
                          className="glass glass-hover rounded-2xl p-5"
                          style={{ borderColor: `color-mix(in srgb, ${severity.color} 45%, transparent)` }}
                        >
                          <p className="text-xs font-medium uppercase tracking-[0.16em]" style={{ color: severity.color }}>
                            {severity.label}
                          </p>
                          <h4 className="display mt-1 text-xl font-semibold">{item.title}</h4>
                          <p className="mt-2 text-sm text-[var(--muted)]">{item.evidence}</p>
                          <p className="mt-3 text-sm leading-6">{item.suggestion}</p>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ) : coaching ? null : (
                <p className="text-[var(--muted)]">No coaching notes for this sample yet.</p>
              )}
            </section>

            <section className={dimming ? "content-dim" : undefined}>
              <h3 className="display mb-4 text-2xl font-semibold">Recent competitive games</h3>
              <div className="glass overflow-x-auto rounded-2xl">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                    <tr>
                      {["", "Result", "Map", "Agent", "K / D / A", "Combat score", "Headshot %", "Openers", "RR"].map(
                        (col) => (
                          <th key={col || "icon"} className="px-3 py-3 font-medium first:pl-4 last:pr-4">
                            {col}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {matches.matches?.map((match) => (
                      <tr key={match.matchId} className="match-row border-t border-[var(--line)]">
                        <td className="px-3 py-2.5 first:pl-4">
                          <AgentPortrait content={content} name={match.agent} size={32} />
                        </td>
                        <td className={`px-3 py-2.5 font-semibold capitalize result-${match.result}`}>
                          {match.result}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-2">
                            <MapThumb content={content} name={match.map} />
                            {match.map}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">{match.agent}</td>
                        <td className="px-3 py-2.5 font-mono">
                          {match.kills}/{match.deaths}/{match.assists}
                        </td>
                        <td className="px-3 py-2.5">{match.acs}</td>
                        <td className="px-3 py-2.5">{match.headshotPercent}%</td>
                        <td className="px-3 py-2.5">
                          {match.firstBloods}/{match.firstDeaths}
                        </td>
                        <td className="px-3 py-2.5 last:pr-4" style={{ color: rrColor(match.rrChange) }}>
                          {match.rrChange == null ? "—" : match.rrChange > 0 ? `+${match.rrChange}` : match.rrChange}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}

        {matches && !matches.config?.hasHenrikKey ? (
          <p className="text-sm text-[var(--warn)]">Match data key is missing, so ranked history cannot load.</p>
        ) : null}

        {matches?.warnings?.length ? (
          <p className="text-xs text-[var(--muted)]">{matches.warnings.join(" · ")}</p>
        ) : null}
      </main>
    </div>
  );
}

function PoolCard({
  title,
  empty,
  content,
  kind,
  rows,
}: {
  title: string;
  empty: string;
  content: ValorantContent | null;
  kind: "agent" | "map";
  rows: {
    name: string;
    games: number;
    winRate: number;
    avgAcs: number;
    casts?: {
      ability1?: number | null;
      ability2?: number | null;
      grenade?: number | null;
      ultimate?: number | null;
    };
  }[];
}) {
  return (
    <article className="glass glass-hover rounded-2xl p-5">
      <h3 className="display text-xl font-semibold">{title}</h3>
      <div className="mt-4 space-y-4">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.name} className="flex gap-3">
              {kind === "agent" ? (
                <AgentPortrait content={content} name={row.name} size={40} />
              ) : (
                <MapThumb content={content} name={row.name} className="mt-0.5 h-10 w-[4.75rem] rounded-md object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-3 text-sm">
                  <span>
                    {row.name}
                    {kind === "agent" && agentRole(content, row.name) ? (
                      <span className="ml-2 text-xs text-[var(--muted)]">{agentRole(content, row.name)}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-[var(--muted)]">
                    {row.winRate}% · {row.games} {row.games === 1 ? "game" : "games"} · {row.avgAcs} ACS
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent-2))]"
                    style={{ width: `${Math.min(100, row.winRate)}%` }}
                  />
                </div>
                {kind === "agent" && row.casts ? (
                  <div className="mt-2">
                    <AbilityCasts content={content} agentName={row.name} casts={row.casts} />
                  </div>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--muted)]">{empty}</p>
        )}
      </div>
    </article>
  );
}
