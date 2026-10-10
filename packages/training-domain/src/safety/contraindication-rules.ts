/**
 * User injury option → internal contraindication tag mapping (SAFE-01a).
 *
 * Authoritative source: docs/TASK3_ALIGNMENT.md §2.2 (derived from
 * docs/PRODUCT_LOGIC.md §2.2.1 "伤病标签映射"). This is the ONLY place
 * in the codebase where this mapping may be defined (AGENTS.md §3:
 * single source of truth, no front/back duplicate rules).
 *
 * Pure data + pure functions. No I/O, no framework dependency.
 */

/**
 * User-facing injury option (Chinese label) → internal contraindication
 * tags used by the canonical exercise library's `contraindications` field.
 */
export const INJURY_OPTION_TAG_MAP: Readonly<Record<string, readonly string[]>> = {
  肩: ['shoulder_impingement', 'rotator_cuff'],
  肘: ['elbow_pain'],
  腕: ['wrist_pain'],
  腰: ['lower_back', 'sciatica'],
  膝: ['knee_pain', 'meniscus'],
  颈: ['neck_pain'],
};

/**
 * Full controlled vocabulary of contraindication tags
 * (docs/PRODUCT_LOGIC.md §5.4).
 */
export const CONTRAINDICATION_TAGS = [
  'shoulder_impingement',
  'rotator_cuff',
  'neck_pain',
  'elbow_pain',
  'wrist_pain',
  'lower_back',
  'sciatica',
  'knee_pain',
  'meniscus',
] as const;

export type ContraindicationTag = (typeof CONTRAINDICATION_TAGS)[number];

export type InjuryOption = keyof typeof INJURY_OPTION_TAG_MAP;

/**
 * Convert a list of user-facing injury options (e.g. ["肩", "膝"]) into
 * the union of internal contraindication tags.
 *
 * Deterministic, no LLM. Unknown options are ignored (never throws),
 * since this is a defensive mapping layer — unmapped values simply
 * produce no additional exclusions (fail safe, not fail silent on
 * known-good values).
 */
export function mapInjuryOptionsToTags(userOptions: readonly string[]): string[] {
  const tags = new Set<string>();
  for (const option of userOptions) {
    const mapped = INJURY_OPTION_TAG_MAP[option];
    if (mapped) {
      for (const tag of mapped) tags.add(tag);
    }
  }
  return [...tags];
}
