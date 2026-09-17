export interface CategoryRule {
  category_id: string;
  term: string;
  weight: number;
}

export interface CategoryScore {
  categoryId: string;
  score: number;
  terms: string[];
}

export interface TicketDraft {
  title: string;
  description: string;
}

export interface TicketClassification {
  categoryId: string | null;
  confidence: number;
  terms: string[];
  scores: CategoryScore[];
}

export interface SlaTarget {
  startAt: string;
  dueAt: string | null;
  doneAt: string | null;
  now: number;
}

export type SlaState = "met" | "on_track" | "due_soon" | "breached" | "unknown";
