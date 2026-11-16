export type Kind = "script" | "novel";

export type Dimensions = {
  plot: number;
  character: number;
  pacing: number;
  language: number;
  completeness: number;
};

export type Review = {
  score: number;
  grade: string;
  decision: "approve" | "reject";
  source: "local" | "model";
  summary: string;
  advice: string[];
  dimensions: Dimensions;
};

export type ActionState = {
  error: string;
};

export type PublicWork = {
  id: number;
  title: string;
  kind: Kind;
  category: string;
  summary: string;
  price: number;
  score: number;
  grade: string;
  wordCount: number;
  createdAt: string;
  author: string;
  status: string;
};

export type SessionUser = {
  id: number;
  username: string;
  email: string;
  coins: number;
};
