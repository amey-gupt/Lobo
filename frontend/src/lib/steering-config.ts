/**
 * Maps admin UI (steering level + toggle) ↔ Modal `multipliers` (floats).
 *
 * - The slider is **not** “% of concept in the output”—it’s a **coefficient** on a learned direction.
 * - Recommended range to try first: ~0.5–2×; UI caps per-channel at MAX_MULTIPLIER_PER_CONCEPT.
 * See backend/STEERING.md.
 */
export const CONCEPT_IDS = [
  "deception",
  "toxicity",
  "danger",
  "happiness",
  "bias",
  "formality",
  "compliance",
] as const

export type ConceptId = (typeof CONCEPT_IDS)[number]

/** Conservative per-channel cap (see STEERING.md: prefer moderate multipliers first). */
export const MAX_MULTIPLIER_PER_CONCEPT = 2

/**
 * Discrete UI steps 0…12 → multiplier 0…MAX.
 * 0 = off; 12 = strongest (use sparingly—can destabilize generation).
 */
export const STEERING_LEVEL_MAX = 12

export function steeringLevelToMultiplier(enabled: boolean, level: number): number {
  if (!enabled) return 0
  const lv = Math.max(0, Math.min(STEERING_LEVEL_MAX, Math.round(level)))
  return (lv / STEERING_LEVEL_MAX) * MAX_MULTIPLIER_PER_CONCEPT
}

export function multiplierToSteeringLevel(multiplier: number): { enabled: boolean; level: number } {
  const m = Number(multiplier) || 0
  if (m <= 0) {
    return { enabled: false, level: 0 }
  }
  const raw = (m / MAX_MULTIPLIER_PER_CONCEPT) * STEERING_LEVEL_MAX
  const level = Math.min(STEERING_LEVEL_MAX, Math.max(1, Math.round(raw)))
  return { enabled: true, level }
}

export function formatMultiplier(enabled: boolean, level: number): string {
  const v = steeringLevelToMultiplier(enabled, level)
  return `${v.toFixed(2)}×`
}

/** Short qualitative label for the discrete level (no “percent” wording). */
export function steeringStrengthLabel(level: number): string {
  const lv = Math.max(0, Math.min(STEERING_LEVEL_MAX, Math.round(level)))
  if (lv === 0) return "Off"
  if (lv <= 3) return "Light"
  if (lv <= 6) return "Moderate"
  if (lv <= 9) return "Strong"
  if (lv <= 11) return "Very strong"
  return "Max"
}

export type MultipliersRecord = Record<string, number>

export function buildMultipliersPayload(
  vectors: { id: string; enabled: boolean; level: number }[]
): MultipliersRecord {
  const out: MultipliersRecord = {}
  for (const id of CONCEPT_IDS) {
    const v = vectors.find((x) => x.id === id)
    out[id] = v ? steeringLevelToMultiplier(v.enabled, v.level) : 0
  }
  return out
}

/** Parse GET / get_config body: Modal may return a flat map or `{ multipliers: {...} }`. */
export function parseMultipliersFromApi(data: unknown): MultipliersRecord {
  if (!data || typeof data !== "object") return {}
  const o = data as Record<string, unknown>
  const inner =
    o.multipliers && typeof o.multipliers === "object"
      ? (o.multipliers as MultipliersRecord)
      : (o as MultipliersRecord)
  const out: MultipliersRecord = {}
  for (const id of CONCEPT_IDS) {
    const v = inner[id]
    out[id] = typeof v === "number" && !Number.isNaN(v) ? v : 0
  }
  return out
}
