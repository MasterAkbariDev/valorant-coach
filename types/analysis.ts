export type AdviceSeverity = "critical" | "improve" | "keep";

export type AdviceItem = {
  title: string;
  severity: AdviceSeverity;
  evidence: string;
  suggestion: string;
  drill?: string;
};

export type MatchAdvice = {
  matchId: string;
  summary: string;
  items: AdviceItem[];
};

export type MatchReview = {
  matchId: string;
  summary: string;
  wrong: { title: string; detail: string }[];
  actions: string[];
};

export type ClipReview = {
  summary: string;
  deaths: AdviceItem[];
  positioning: AdviceItem[];
  aim: AdviceItem[];
  utility: AdviceItem[];
};
