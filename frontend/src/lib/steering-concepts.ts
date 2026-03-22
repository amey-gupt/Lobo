/**
 * Ordered steering concept keys (same order as backend CONCEPTS in modal_app.py).
 * Use for Gemini prompts and admin UI labels.
 */
import { CONCEPT_IDS, type ConceptId } from "./steering-config"

export { CONCEPT_IDS, type ConceptId }

/** Human-readable labels for Chats / metrics (match dashboard wording). */
export const CONCEPT_LABELS: Record<ConceptId, string> = {
  deception: "Deception",
  toxicity: "Toxicity",
  danger: "Danger",
  warmth: "Warmth (support)",
  stereotypes: "Stereotypes",
  formality: "Formality",
  legal_compliance: "Legal / policy",
}
