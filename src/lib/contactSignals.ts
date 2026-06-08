import type { Temperature } from './contact';

export interface ContactSignals {
  score: number;            // 0–100 AI fit score
  temperature: Temperature; // AI temperature
  tags: string[];           // up to 2 AI tags
}

/**
 * Produce the AI-derived signals for a contact.
 *
 * TODO(ai): replace this deterministic placeholder with a real LLM call. It is
 * intentionally a stub so the rest of the app — persistence and
 * recalculation-on-action — is fully wired and ready for the model swap.
 */
export function generateContactSignals(name: string, company: string): ContactSignals {
  void name;
  void company;
  return { score: 50, temperature: 'Medium', tags: [] };
}
