import type { CategoryRule, CategoryScore } from "@cofar/types";
import type { SlaState, SlaTarget } from "@cofar/types";
import type { TicketClassification, TicketDraft } from "@cofar/types";

const DIACRITICS = /[̀-ͯ]/g;
const NON_WORD = /[^a-z0-9]+/g;
const TITLE_WEIGHT = 2;
const MAX_OCCURRENCES = 3;

// A term only counts as evidence when it is a whole word, so padding both the
// text and the term with spaces turns boundary matching into a substring scan.
export const normalizeText = (value: string) => {
  const lowered = value.toLowerCase().normalize("NFD").replace(DIACRITICS, "");

  return ` ${lowered.replace(NON_WORD, " ").trim()} `;
};

const countMatches = (haystack: string, needle: string) => {
  let count = 0;
  let index = haystack.indexOf(needle);

  while (index !== -1 && count < MAX_OCCURRENCES) {
    count = count + 1;
    index = haystack.indexOf(needle, index + needle.length - 1);
  }

  return count;
};

const scoreRule = (title: string, description: string, rule: CategoryRule) => {
  const needle = normalizeText(rule.term);

  if (needle.trim().length < 2) {
    return 0;
  }

  const inTitle = countMatches(title, needle) * TITLE_WEIGHT;
  const inDescription = countMatches(description, needle);

  return (inTitle + inDescription) * rule.weight;
};

const rankScores = (scores: Map<string, CategoryScore>) => {
  const ranked = [...scores.values()].filter(entry => {
    return entry.score > 0;
  });

  return ranked.sort((left, right) => {
    return right.score - left.score;
  });
};

export const MIN_CLASSIFICATION_SCORE = 4;
export const MIN_CLASSIFICATION_CONFIDENCE = 0.55;

// Deterministic, explainable classifier: weighted keyword evidence per category.
// Anything ambiguous stays unclassified instead of guessing, and an agent decides.
export const classifyTicket = (
  draft: TicketDraft,
  rules: CategoryRule[]
): TicketClassification => {
  const title = normalizeText(draft.title);
  const description = normalizeText(draft.description);
  const scores = new Map<string, CategoryScore>();

  for (const rule of rules) {
    const score = scoreRule(title, description, rule);

    if (score === 0) {
      continue;
    }

    const current = scores.get(rule.category_id);
    const entry = current ?? {
      categoryId: rule.category_id,
      score: 0,
      terms: []
    };

    entry.score = entry.score + score;
    entry.terms.push(rule.term);
    scores.set(rule.category_id, entry);
  }

  const ranked = rankScores(scores);
  const best = ranked[0];
  const empty = { categoryId: null, confidence: 0, terms: [], scores: ranked };

  if (!best) {
    return empty;
  }

  const total = ranked.reduce((sum, entry) => {
    return sum + entry.score;
  }, 0);
  const confidence = Math.round((best.score / total) * 1000) / 1000;
  const tied = ranked[1]?.score === best.score;
  const weak = best.score < MIN_CLASSIFICATION_SCORE;

  if (tied || weak || confidence < MIN_CLASSIFICATION_CONFIDENCE) {
    return { ...empty, confidence, scores: ranked };
  }

  return {
    categoryId: best.categoryId,
    confidence,
    terms: best.terms,
    scores: ranked
  };
};

export const DUE_SOON_SHARE = 0.2;

// Traffic light for one SLA target, shared by the queue, the detail view and tests.
export const getSlaState = (target: SlaTarget): SlaState => {
  if (!target.dueAt) {
    return "unknown";
  }

  const due = Date.parse(target.dueAt);
  const done = target.doneAt ? Date.parse(target.doneAt) : null;

  if (done !== null) {
    return done <= due ? "met" : "breached";
  }

  if (target.now > due) {
    return "breached";
  }

  const window = Math.max(due - Date.parse(target.startAt), 1);
  const remaining = due - target.now;

  return remaining <= window * DUE_SOON_SHARE ? "due_soon" : "on_track";
};
