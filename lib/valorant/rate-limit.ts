const WINDOW_MS = 60_000;
const DEFAULT_MAX = 30;

const timestamps: number[] = [];

function maxRpm() {
  const parsed = Number(process.env.HENRIK_MAX_RPM);
  const max = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX;
  return Math.max(1, max - 2);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForHenrikSlot() {
  while (true) {
    const now = Date.now();
    while (timestamps.length && now - timestamps[0] >= WINDOW_MS) {
      timestamps.shift();
    }
    if (timestamps.length < maxRpm()) {
      timestamps.push(now);
      return;
    }
    await sleep(Math.max(50, WINDOW_MS - (now - timestamps[0]) + 25));
  }
}
