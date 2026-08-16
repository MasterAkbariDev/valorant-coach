import { NextResponse } from "next/server";
import { analyzeRankedStats } from "@/lib/gemini/client";
import { playerKey, readStoredAdvice, writeStoredAdvice } from "@/lib/db";
import { aiEnabled, redactSecrets } from "@/lib/env";
import { parseIdentity } from "@/lib/riot-id";
import { aggregateMatches } from "@/lib/stats/aggregate";
import { loadPlayerBundle } from "@/lib/valorant/client";
import { compactMatch } from "@/lib/valorant/normalize";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function fingerprintOf(matches: { matchId: string }[]) {
  return matches
    .map((match) => match.matchId)
    .sort()
    .join("|");
}

export async function POST(request: Request) {
  try {
    if (!aiEnabled()) {
      return NextResponse.json(
        { ok: false, error: "Coach AI is disabled (AI_ENABLED=false in .env.local)." },
        { status: 503 },
      );
    }
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      tag?: string;
      region?: string;
      refresh?: boolean;
    };
    const identity = parseIdentity(body);
    if (!identity) {
      return NextResponse.json({ ok: false, error: "Use Riot ID as Name#Tag." }, { status: 400 });
    }
    const bundle = await loadPlayerBundle(identity, { refresh: Boolean(body.refresh) });
    const insights = aggregateMatches(bundle.matches, bundle.career);
    const key = playerKey(bundle.identity.name, bundle.identity.tag, bundle.identity.region);
    const fingerprint = fingerprintOf(bundle.matches);
    const stored = readStoredAdvice(key);

    // Same games as last time = nothing new to coach. Reuse stored notes, no AI call.
    if (stored && stored.fingerprint === fingerprint) {
      return NextResponse.json({
        ok: true,
        cached: true,
        generatedAt: stored.createdAt,
        fetchedAt: Date.now(),
        insights,
        advice: stored.advice,
        matchCount: bundle.matches.length,
        warnings: bundle.warnings,
      });
    }

    try {
      const advice = await analyzeRankedStats({
        identity: bundle.identity,
        insights,
        matches: bundle.details.map(compactMatch),
        warnings: bundle.warnings,
      });
      writeStoredAdvice(key, fingerprint, advice);
      return NextResponse.json({
        ok: true,
        cached: false,
        generatedAt: Date.now(),
        fetchedAt: Date.now(),
        insights,
        advice,
        matchCount: bundle.matches.length,
        warnings: bundle.warnings,
      });
    } catch (error) {
      // AI failed or returned nothing usable — fall back to the last stored notes.
      if (stored) {
        return NextResponse.json({
          ok: true,
          cached: true,
          generatedAt: stored.createdAt,
          fetchedAt: Date.now(),
          insights,
          advice: stored.advice,
          matchCount: bundle.matches.length,
          warnings: bundle.warnings,
          error: "Coach AI didn't return new notes. Showing your last stored notes.",
        });
      }
      throw error;
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? redactSecrets(error.message) : "Analysis failed" },
      { status: 500 },
    );
  }
}
