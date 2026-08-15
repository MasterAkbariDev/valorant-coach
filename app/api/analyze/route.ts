import { NextResponse } from "next/server";
import { analyzeRankedStats } from "@/lib/gemini/client";
import { redactSecrets } from "@/lib/env";
import { parseIdentity } from "@/lib/riot-id";
import { aggregateMatches } from "@/lib/stats/aggregate";
import { loadPlayerBundle } from "@/lib/valorant/client";
import { compactMatch } from "@/lib/valorant/normalize";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
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
    const advice = await analyzeRankedStats({
      identity: bundle.identity,
      insights,
      matches: bundle.details.map(compactMatch),
      warnings: bundle.warnings,
    });
    return NextResponse.json({
      ok: true,
      fetchedAt: Date.now(),
      insights,
      advice,
      matchCount: bundle.matches.length,
      warnings: bundle.warnings,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? redactSecrets(error.message) : "Analysis failed" },
      { status: 500 },
    );
  }
}
