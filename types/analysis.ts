export type AdviceSeverity = "critical" | "improve" | "keep";

export type AdviceItem = {
  title: string;
  severity: AdviceSeverity;
  evidence: string;
  suggestion: string;
};

export type MatchAdvice = {
  matchId: string;
  summary: string;
  items: AdviceItem[];
};

export type ClipReview = {
  summary: string;
  deaths: AdviceItem[];
  positioning: AdviceItem[];
  aim: AdviceItem[];
  utility: AdviceItem[];
};
