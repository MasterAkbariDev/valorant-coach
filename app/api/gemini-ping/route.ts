import { NextResponse } from "next/server";
import { pingGemini } from "@/lib/gemini/client";
import { getPublicConfig, redactSecrets } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getPublicConfig();
  try {
    const { reply, model } = await pingGemini();
    return NextResponse.json({
      ok: true,
      hasGeminiKey: config.hasGeminiKey,
      geminiModel: model,
      reply,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        config: { hasGeminiKey: config.hasGeminiKey, geminiModel: config.geminiModel },
        error: error instanceof Error ? redactSecrets(error.message) : "Gemini ping failed",
      },
      { status: 500 },
    );
  }
}
