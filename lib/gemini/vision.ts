import { generateContentWithFallback } from "@/lib/gemini/generate";
import { CLIP_REVIEW_SYSTEM, clipSchema } from "@/lib/gemini/prompts";
import type { ClipReview } from "@/types/analysis";

function parseReview(raw: string): ClipReview {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(cleaned) as ClipReview;
  return {
    summary: parsed.summary || "No summary returned.",
    deaths: parsed.deaths ?? [],
    positioning: parsed.positioning ?? [],
    aim: parsed.aim ?? [],
    utility: parsed.utility ?? [],
  };
}

export async function reviewDeathClip(file: { bytes: Buffer; mimeType: string }): Promise<ClipReview> {
  const prompt =
    "This clip should be ~10 seconds before the player's death through ~3 seconds after. Review the death.";

  const { text } = await generateContentWithFallback({
    contents: [
      {
        role: "user",
        parts: [
          { text: `${CLIP_REVIEW_SYSTEM}\n\n${prompt}` },
          {
            inlineData: {
              mimeType: file.mimeType,
              data: file.bytes.toString("base64"),
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: clipSchema,
      temperature: 0.3,
    },
  });

  return parseReview(text);
}
