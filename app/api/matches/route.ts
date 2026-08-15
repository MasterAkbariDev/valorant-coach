import { NextResponse } from "next/server";
import { getPublicConfig, redactSecrets } from "@/lib/env";
import { parseIdentity } from "@/lib/riot-id";
import { aggregateMatches } from "@/lib/stats/aggregate";
import { loadPlayerBundle } from "@/lib/valorant/client";
import { HenrikError } from "@/lib/valorant/errors";
import { compactMatch } from "@/lib/valorant/normalize";

export const dynamic = "force-dynamic";

type LookupInput = {
  name?: string | null;
  tag?: string | null;
  region?: string | null;
  refresh?: boolean;
};

async function lookup(input: LookupInput) {
  const config = getPublicConfig();
  const identity = parseIdentity(input);
  if (!identity) {
    return NextResponse.json(
      { ok: false, config, error: "Use Riot ID as Name#Tag, for example TenZ#NA1." },
      { status: 400 },
    );
  }
  try {
    const bundle = await loadPlayerBundle(identity, { refresh: Boolean(input.refresh) });
    const insights = aggregateMatches(bundle.matches, bundle.career);
    return NextResponse.json({
      ok: true,
      fetchedAt: Date.now(),
      cached: !input.refresh,
      config,
      identity: bundle.identity,
      account: bundle.account,
      career: bundle.career,
      insights,
      matches: bundle.details.map(compactMatch),
      warnings: bundle.warnings,
      source: bundle.source,
    });
  } catch (error) {
    const status = error instanceof HenrikError ? error.status : 500;
    return NextResponse.json(
      {
        ok: false,
        config,
        error: error instanceof Error ? redactSecrets(error.message) : "Failed to load matches",
      },
      { status: status === 401 || status === 404 || status === 429 ? 200 : status },
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return lookup({
    name: url.searchParams.get("name"),
    tag: url.searchParams.get("tag"),
    region: url.searchParams.get("region"),
    refresh: url.searchParams.get("refresh") === "1",
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as LookupInput;
  return lookup(body);
}
