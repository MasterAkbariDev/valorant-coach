import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { MatchAdvice, MatchReview } from "@/types/analysis";

let db: Database.Database | null = null;

function getDb() {
  if (db) return db;
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  db = new Database(path.join(dir, "coach.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS advice (
      player_key TEXT PRIMARY KEY,
      fingerprint TEXT NOT NULL,
      advice_json TEXT NOT NULL,
      model TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS match_reviews (
      key TEXT PRIMARY KEY,
      review_json TEXT NOT NULL,
      model TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  return db;
}

export function playerKey(name: string, tag: string, region: string) {
  return `${name}#${tag}:${region}`.toLowerCase();
}

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function readStoredAdvice(key: string) {
  const row = getDb()
    .prepare<[string], { fingerprint: string; advice_json: string; created_at: number }>(
      "SELECT fingerprint, advice_json, created_at FROM advice WHERE player_key = ?",
    )
    .get(key);
  if (!row) return null;
  const advice = parseJson<MatchAdvice>(row.advice_json);
  if (!advice) return null;
  return { fingerprint: row.fingerprint, advice, createdAt: row.created_at };
}

export function writeStoredAdvice(key: string, fingerprint: string, advice: MatchAdvice, model?: string) {
  getDb()
    .prepare(
      `INSERT INTO advice (player_key, fingerprint, advice_json, model, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(player_key) DO UPDATE SET
         fingerprint = excluded.fingerprint,
         advice_json = excluded.advice_json,
         model = excluded.model,
         created_at = excluded.created_at`,
    )
    .run(key, fingerprint, JSON.stringify(advice), model ?? null, Date.now());
}

export function readStoredReview(key: string) {
  const row = getDb()
    .prepare<[string], { review_json: string; created_at: number }>(
      "SELECT review_json, created_at FROM match_reviews WHERE key = ?",
    )
    .get(key);
  if (!row) return null;
  const review = parseJson<MatchReview>(row.review_json);
  if (!review) return null;
  return { review, createdAt: row.created_at };
}

export function writeStoredReview(key: string, review: MatchReview, model?: string) {
  getDb()
    .prepare(
      `INSERT INTO match_reviews (key, review_json, model, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         review_json = excluded.review_json,
         model = excluded.model,
         created_at = excluded.created_at`,
    )
    .run(key, JSON.stringify(review), model ?? null, Date.now());
}
