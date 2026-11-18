"use client";

import { useEffect, useState } from "react";

export function StageLoading(props: { title: string; steps: string[]; hint?: string }) {
  return <StageLoadingContent key={`${props.title}:${props.steps.length}`} {...props} />;
}

function StageLoadingContent({
  title,
  steps,
  hint,
}: {
  title: string;
  steps: string[];
  hint?: string;
}) {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(10);

  useEffect(() => {
    const stepTimer = window.setInterval(() => {
      setStep((current) => (current < steps.length - 1 ? current + 1 : current));
    }, 1600);
    const barTimer = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 90) return 90;
        return current + Math.max(1, Math.round((90 - current) * 0.1));
      });
    }, 220);
    return () => {
      window.clearInterval(stepTimer);
      window.clearInterval(barTimer);
    };
  }, [steps.length, title]);

  return (
    <section className="coach-loading glass fade-up overflow-hidden rounded-2xl p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <div className="coach-orb" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--accent)]">{title}</p>
          <p className="display mt-1 text-xl font-semibold sm:text-2xl">{steps[step]}</p>
          {hint ? <p className="mt-1 text-sm text-[var(--muted)]">{hint}</p> : null}
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="coach-bar h-full rounded-full" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
      <ol className="mt-5 grid gap-2 sm:grid-cols-2">
        {steps.map((item, index) => {
          const state = index < step ? "done" : index === step ? "active" : "wait";
          return (
            <li key={item} className={`coach-step coach-step-${state}`}>
              <span className="coach-step-mark">{index < step ? "✓" : index + 1}</span>
              {item}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const SEARCH_STEPS = [
  "Resolving that Riot ID",
  "Reading rank and RR",
  "Fetching competitive games",
  "Scoring combat, openers, and utility",
];

export function SearchLoading({ riotId }: { riotId?: string }) {
  return (
    <div className="space-y-4">
      <StageLoading
        title="Loading ranked profile"
        hint={riotId ? `Searching ${riotId}` : "Pulling live match data"}
        steps={SEARCH_STEPS}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {["Rank", "Recent form", "Combat"].map((label, index) => (
          <article
            key={label}
            className="glass rounded-2xl p-4"
            style={{ animation: `fade-up 0.5s ease ${0.12 * index}s both` }}
          >
            <p className="text-xs text-[var(--muted)]">{label}</p>
            <div className="mt-3 h-8 w-24 rounded-md skeleton" />
            <div className="mt-2 h-3 w-full rounded skeleton" />
          </article>
        ))}
      </div>
      <div className="glass overflow-hidden rounded-2xl">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 border-t border-[var(--line)] px-4 py-3 first:border-t-0"
            style={{ animation: `match-in 0.55s ease ${0.18 * index}s both` }}
          >
            <span className="h-8 w-8 rounded-lg skeleton" />
            <span className="h-3 w-16 rounded skeleton" />
            <span className="h-3 w-24 rounded skeleton" />
            <span className="ml-auto h-3 w-20 rounded skeleton" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CoachLoading({
  title = "Gemini is coaching",
}: {
  title?: string;
}) {
  return (
    <StageLoading
      title={title}
      steps={[
        "Reading the last ranked games",
        "Checking agents, maps, and openers",
        "Finding the highest-leverage leak",
        "Writing notes you can use next queue",
      ]}
    />
  );
}
