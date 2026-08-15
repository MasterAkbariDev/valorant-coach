"use client";

import { useEffect, useState } from "react";
import AppHeader, { applyTheme } from "@/components/AppHeader";
import CoachLoading from "@/components/CoachLoading";
import { THEME_KEY, type ThemeId } from "@/lib/player-session";

type AdviceItem = {
  title: string;
  severity: string;
  evidence: string;
  suggestion: string;
};

type Review = {
  summary: string;
  deaths: AdviceItem[];
  positioning: AdviceItem[];
  aim: AdviceItem[];
  utility: AdviceItem[];
};

const SEVERITY: Record<string, string> = {
  critical: "Rank leak",
  improve: "Next games",
  keep: "Keep this",
};

export default function ClipReviewForm() {
  const [theme, setTheme] = useState<ThemeId>("crimson");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState<Review | null>(null);

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_KEY) as ThemeId | null;
    if (storedTheme) {
      setTheme(storedTheme);
      applyTheme(storedTheme);
    }
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("clip");
    if (!(file instanceof File) || !file.size) {
      setError("Pick a short clip first.");
      return;
    }
    setBusy(true);
    setError("");
    setReview(null);
    const response = await fetch("/api/review", { method: "POST", body: data });
    const json = await response.json();
    setBusy(false);
    if (!json.ok) {
      setError(json.error || "Review failed");
      return;
    }
    setReview(json.review as Review);
  }

  return (
    <div className="app-shell">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
        <AppHeader
          theme={theme}
          active="clip"
          onTheme={(next) => {
            setTheme(next);
            applyTheme(next);
          }}
        />
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent)]">Vision review</p>
          <h2 className="display mt-1 text-3xl font-semibold">Death clip</h2>
          <p className="mt-2 max-w-xl text-[var(--muted)]">
            Upload about 10 seconds before the death through 3 seconds after. Keep the file under 20MB.
            The coach will describe the peek, utility, and whether the death was avoidable.
          </p>
        </div>
        <form onSubmit={onSubmit} className="glass space-y-4 rounded-2xl p-6">
          <label className="flex cursor-pointer flex-col gap-3 rounded-xl border border-dashed border-[var(--line)] p-10 text-center hover:border-[var(--accent)]">
            <span className="display text-xl">Drop or choose a clip</span>
            <input className="mx-auto" type="file" name="clip" accept="video/*" required />
          </label>
          <button type="submit" disabled={busy} className="btn-primary rounded-xl px-6 py-3">
            {busy ? "Watching the clip…" : "Analyze clip"}
          </button>
        </form>
        {busy ? <CoachLoading title="Gemini is watching the clip" /> : null}
        {error ? <p className="text-[var(--bad)]">{error}</p> : null}
        {review ? (
          <section className="space-y-4">
            <p className="glass rounded-2xl p-5 text-base leading-7">{review.summary}</p>
            {(
              [
                ["Death", review.deaths],
                ["Positioning", review.positioning],
                ["Aim", review.aim],
                ["Utility", review.utility],
              ] as const
            ).map(([label, items]) => (
              <div key={label} className="glass rounded-2xl p-5">
                <h3 className="display text-xl font-semibold">{label}</h3>
                {items.length ? (
                  items.map((item) => (
                    <article key={item.title} className="mt-3 border-t border-[var(--line)] pt-3">
                      <p className="text-xs text-[var(--muted)]">{SEVERITY[item.severity] ?? item.severity}</p>
                      <h4 className="font-medium">{item.title}</h4>
                      <p className="mt-1 text-sm text-[var(--muted)]">{item.evidence}</p>
                      <p className="mt-2 text-sm">{item.suggestion}</p>
                    </article>
                  ))
                ) : (
                  <p className="mt-2 text-sm text-[var(--muted)]">Nothing notable here.</p>
                )}
              </div>
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}
