# Valorant Coach

Personal web app for **not HIM#8585**: match stats, Gemini ranked advice, death-clip vision.

## Env

Copy `.env.example` to `.env.local`.

- `GEMINI_API_KEY` — Google AI Studio free key
- `RIOT_NAME` / `RIOT_TAG` / `RIOT_REGION`
- `HENRIK_DEV_API_KEY` — required for match JSON. Free basic key from [HenrikDev Discord](https://discord.com/invite/X3GaVkX2YN) → verify → **#get-a-key** → VALORANT (Basic Key)

Never commit `.env.local`.

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Clip review is at `/review`.

No in-game overlay, no Riot password, no client hooks.
