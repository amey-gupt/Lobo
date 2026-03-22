/**
 * Maps admin UI (0–100% intensity + toggle) ↔ Modal `multipliers` (floats).
 * Backend caps combined steering step; per-concept scale uses MAX_MULTIPLIER_PER_CONCEPT at 100% intensity.
 * See backend/STEERING.md for steering semantics.
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

/** At 100% slider, multiplier sent to Modal (aligns with backend step cap). */
export const MAX_MULTIPLIER_PER_CONCEPT = 5

export function intensityToMultiplier(enabled: boolean, intensity: number): number {
  if (!enabled) return 0
  const clamped = Math.max(0, Math.min(100, intensity))
  return (clamped / 100) * MAX_MULTIPLIER_PER_CONCEPT
}

export function multiplierToIntensity(multiplier: number): { enabled: boolean; intensity: number } {
  const m = Number(multiplier) || 0
  if (m <= 0) {
    return { enabled: false, intensity: 0 }
  }
  const raw = (m / MAX_MULTIPLIER_PER_CONCEPT) * 100
  const intensity = Math.min(100, Math.round(raw / 5) * 5)
  return { enabled: true, intensity }
}

export type MultipliersRecord = Record<string, number>

export function buildMultipliersPayload(
  vectors: { id: string; enabled: boolean; intensity: number }[]
): MultipliersRecord {
  const out: MultipliersRecord = {}
  for (const id of CONCEPT_IDS) {
    const v = vectors.find((x) => x.id === id)
    out[id] = v ? intensityToMultiplier(v.enabled, v.intensity) : 0
  }
  return out
}

/** Parse GET / get_config body: Modal may return a flat map or `{ multipliers: {...} }`. */
export function parseMultipliersFromApi(data: unknown): MultipliersRecord {
  if (!data || typeof data !== "object") return {}
  const o = data as Record<string, unknown>
  const inner = o.multipliers && typeof o.multipliers === "object" ? (o.multipliers as MultipliersRecord) : (o as MultipliersRecord)
  const out: MultipliersRecord = {}
  for (const id of CONCEPT_IDS) {
    const v = inner[id]
    out[id] = typeof v === "number" && !Number.isNaN(v) ? v : 0
  }
  return out
}
