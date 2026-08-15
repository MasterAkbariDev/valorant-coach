"use client";

import { useEffect, useState } from "react";
import type { ValorantContent } from "@/lib/valorant/content";

const CONTENT_KEY = "valorant-coach:content";
const CONTENT_TTL = 12 * 60 * 60 * 1000;

export function useValorantContent() {
  const [content, setContent] = useState<ValorantContent | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CONTENT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { at: number; content: ValorantContent };
        if (parsed.content && Date.now() - parsed.at < CONTENT_TTL) {
          setContent(parsed.content);
        }
      }
    } catch {
      /* ignore */
    }

    void fetch("/api/content")
      .then((response) => response.json())
      .then((json: { ok?: boolean; content?: ValorantContent }) => {
        if (!json.ok || !json.content) return;
        setContent(json.content);
        localStorage.setItem(CONTENT_KEY, JSON.stringify({ at: Date.now(), content: json.content }));
      })
      .catch(() => undefined);
  }, []);

  return content;
}
