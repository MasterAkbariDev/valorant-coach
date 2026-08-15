import { NextResponse } from "next/server";
import { loadValorantContent } from "@/lib/valorant/content";

export const revalidate = 43200;

export async function GET() {
  try {
    const content = await loadValorantContent();
    return NextResponse.json({ ok: true, content });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Content failed" },
      { status: 500 },
    );
  }
}
