import { NextResponse } from "next/server";
import { getPublicConfig } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, ...getPublicConfig() });
}
