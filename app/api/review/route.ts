import { NextResponse } from "next/server";
import { reviewDeathClip } from "@/lib/gemini/vision";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED = new Set(["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"]);
const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("clip");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Upload a clip file named clip." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "Clip must be under 20MB." }, { status: 400 });
    }
    const mimeType = ALLOWED.has(file.type) ? file.type : "video/mp4";
    const bytes = Buffer.from(await file.arrayBuffer());
    const review = await reviewDeathClip({ bytes, mimeType });
    return NextResponse.json({ ok: true, review, fileName: file.name, size: file.size });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Clip review failed" },
      { status: 500 },
    );
  }
}
