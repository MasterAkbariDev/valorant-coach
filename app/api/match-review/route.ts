import { NextResponse } from "next/server";
import { reviewSingleMatch } from "@/lib/gemini/client";
import { playerKey, readStoredReview, writeStoredReview } from "@/lib/db";
import { aiEnabled, redactSecrets } from "@/lib/env";
import { parseIdentity } from "@/lib/riot-id";
import { loadPlayerBundle } from "@/lib/valorant/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
      matchId?: string;
    };
    const identity = parseIdentity(body);
    if (!identity || !body.matchId) {
      return NextResponse.json({ ok: false, error: "Missing player or match id." }, { status: 400 });
    }

    // Finished matches never change, so stored reviews are permanent.
    const key = `${playerKey(identity.name, identity.tag, identity.region)}:${body.matchId}`;
    const stored = readStoredReview(key);
    if (stored) {
      return NextResponse.json({ ok: true, review: stored.review, cached: true });
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
    writeStoredReview(key, review);
    return NextResponse.json({ ok: true, review });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? redactSecrets(error.message) : "Match review failed" },
      { status: 500 },
    );
  }
}
