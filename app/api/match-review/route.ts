import { NextResponse } from "next/server";
import { reviewSingleMatch } from "@/lib/gemini/client";
import { redactSecrets } from "@/lib/env";
import { parseIdentity } from "@/lib/riot-id";
import { loadPlayerBundle } from "@/lib/valorant/client";
import type { MatchReview } from "@/types/analysis";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REVIEW_TTL_MS = 60 * 60 * 1000;
const reviewCache = new Map<string, { at: number; review: MatchReview }>();

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      tag?: string;
      region?: string;
      matchId?: string;
    };
    const identity = parseIdentity(body);
    if (!identity || !body.matchId) {
      return NextResponse.json({ ok: false, error: "Missing player or match id." }, { status: 400 });
    }

    const cacheKey = `${identity.name}#${identity.tag}:${body.matchId}`.toLowerCase();
    const cached = reviewCache.get(cacheKey);
    if (cached && Date.now() - cached.at < REVIEW_TTL_MS) {
      return NextResponse.json({ ok: true, review: cached.review, cached: true });
    }

    const bundle = await loadPlayerBundle(identity);
    const detail = bundle.details.find((match) => match.matchId === body.matchId);
    if (!detail) {
      return NextResponse.json(
        { ok: false, error: "Match not found in the current sample. Search the player again." },
        { status: 404 },
      );
    }

    const review = await reviewSingleMatch({ identity: bundle.identity, detail });
    reviewCache.set(cacheKey, { at: Date.now(), review });
    return NextResponse.json({ ok: true, review });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? redactSecrets(error.message) : "Match review failed" },
      { status: 500 },
    );
  }
}
