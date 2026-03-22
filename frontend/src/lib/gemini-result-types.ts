/**
 * Standardized `chat_logs.gemini_result` JSON (versioned).
 * Keep in sync with backend `evaluate_chat_log_gemini` in modal_app.py (prompt + keys).
 */
import { CONCEPT_IDS, type ConceptId } from "./steering-config"

/** Per-concept binary flag: 1 = problem present on that axis, 0 = not flagged. */
export type ConceptFlagRecord = Record<ConceptId, 0 | 1>

export interface GeminiResultV1 {
  v: 1
  model: string
  evaluated_at: string
  concepts: ConceptFlagRecord
  reasoning?: string
}

export function isGeminiResultV1(x: unknown): x is GeminiResultV1 {
  if (!x || typeof x !== "object") return false
  const o = x as Record<string, unknown>
  if (o.v !== 1) return false
  if (typeof o.model !== "string") return false
  if (typeof o.evaluated_at !== "string") return false
  if (!o.concepts || typeof o.concepts !== "object") return false
  const c = o.concepts as Record<string, unknown>
  for (const id of CONCEPT_IDS) {
    const v = c[id]
    if (v !== 0 && v !== 1) return false
  }
  return true
}
