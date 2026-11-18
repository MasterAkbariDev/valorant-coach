# Valorant Coach

Personal ranked coach for any Riot ID. Pulls competitive history, scores agents/maps/games like Tracker.gg, and writes concrete next-queue advice. Optional death-clip vision review on `/review`.

No in-game overlay, no Riot password, no client hooks. Match data comes from [HenrikDev](https://docs.henrikdev.xyz/); coaching runs on free AI keys (Gemini first, then Groq / Cerebras / OpenRouter / Mistral).

> **Status:** Experimental personal project. Match data and AI analysis require third-party services and credentials. Ratings are project-defined and should not be interpreted as official rankings.

## What you get

- **Ranked dashboard** — search `Name#Tag` + region, see RR, form, streak, ADR, and a 0–1000 player score
- **Agent / map ratings** — Tracker-style tier badges (S–D) from win rate, ACS, K/D, and ADR
- **Coach notes** — overall sample review with keep / improve / critical cards and a drill on each card
- **Per-match review** — click a game for its rating, death chips, and an AI VOD-style read (loads only when the row opens)
- **Death clip review** — upload a short clip at `/review` for positioning / aim / utility notes

Profiles cache in the browser for a couple of minutes so re-searching the same player is fast. Empty AI replies never wipe good cached notes.

## Setup

```bash
cp .env.example .env.local
npm install
```

### Required

| Variable | Purpose |
| --- | --- |
| `HENRIK_DEV_API_KEY` | Match JSON. Free basic key from [HenrikDev Discord](https://discord.com/invite/X3GaVkX2YN) → verify → **#get-a-key** → VALORANT (Basic Key) |
| At least one coach key | See below |

### Coach AI (use any combination)

| Variable | Notes |
| --- | --- |
| `GEMINI_API_KEY` | Primary. Free key from [Google AI Studio](https://aistudio.google.com/apikey) |
| `GEMINI_API_KEY_2` … `GEMINI_API_KEY_8` or `GEMINI_API_KEYS` | Extra Gemini keys when the first hits the free daily cap |
| `GROQ_API_KEY` | Strong free fallbacks (Kimi, Llama, Qwen, …) |
| `CEREBRAS_API_KEY` | Optional Llama fallback |
| `OPENROUTER_API_KEY` | Free-tier models (DeepSeek, Gemini Flash, …) |
| `MISTRAL_API_KEY` | Optional Mistral Small |

Order: Gemini (capable) → Groq → Cerebras → OpenRouter → Mistral → Gemini lite. Keys stay server-side only.

### Optional defaults

```bash
RIOT_NAME=
RIOT_TAG=
RIOT_REGION=eu          # eu | na | ap | kr | latam | br
GEMINI_MODEL=gemini-3.6-flash
HENRIK_MAX_RPM=30
```

Never commit `.env.local`.

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Clip review is at `/review`.

```bash
npm run build && npm start   # production
npm run lint
```

## Stack

Next.js (App Router) · TypeScript · Tailwind · HenrikDev VALORANT API · Gemini / OpenAI-compatible coach providers
