"use client";

import Link from "next/link";
import { THEME_KEY, type ThemeId } from "@/lib/player-session";

const THEMES: { id: ThemeId; label: string }[] = [
  { id: "crimson", label: "Crimson" },
  { id: "ion", label: "Ion" },
  { id: "protocol", label: "Protocol" },
  { id: "radiant", label: "Radiant" },
];

export function applyTheme(theme: ThemeId) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
}

export default function AppHeader({
  theme,
  onTheme,
  active,
}: {
  theme: ThemeId;
  onTheme: (theme: ThemeId) => void;
  active: "ranked" | "clip";
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="hero-glow grid h-10 w-10 place-items-center rounded-xl bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] text-sm font-bold text-[#0b0d12]">
          VC
        </span>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--muted)]">
            Personal ranked coach
          </p>
          <h1 className="display text-2xl font-semibold tracking-tight sm:text-3xl">Valorant Coach</h1>
        </div>
      </div>
      <nav className="flex flex-wrap items-center gap-2">
        <Link href="/" className={`nav-pill ${active === "ranked" ? "nav-pill-active" : ""}`}>
          Ranked review
        </Link>
        <Link href="/review" className={`nav-pill ${active === "clip" ? "nav-pill-active" : ""}`}>
          Death clip
        </Link>
        <span className="mx-1 hidden h-5 w-px bg-[var(--line)] sm:block" />
        {THEMES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onTheme(item.id)}
            className={`theme-dot ${theme === item.id ? "theme-dot-active" : ""}`}
            data-theme-preview={item.id}
            aria-label={item.label}
            title={item.label}
          />
        ))}
      </nav>
    </header>
  );
}
