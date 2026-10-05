import { EligibilityCategory, EquipmentId, ExerciseCategory, InjurySelection, InjuryTag, MuscleGroup, ProjectId, ReviewStatus, TrainingExperience } from './types';

export const PROJECT_IDS = ['tricep_tone', 'hip_thigh_tone', 'lower_abs_tone', 'trap_relax', 'round_shoulder_fix', 'full_body_basic'] as const satisfies readonly ProjectId[];
export const INJURY_SELECTIONS = ['shoulder', 'neck', 'elbow', 'wrist', 'back', 'knee'] as const satisfies readonly InjurySelection[];
export const INJURY_TAGS = ['shoulder_impingement', 'rotator_cuff', 'neck_pain', 'elbow_pain', 'wrist_pain', 'lower_back', 'sciatica', 'knee_pain', 'meniscus'] as const satisfies readonly InjuryTag[];
export const EXERCISE_CATEGORIES = ['strength', 'warmup', 'stretch', 'cardio'] as const satisfies readonly ExerciseCategory[];
export const REVIEW_STATUSES = ['draft', 'needs_review', 'approved', 'deprecated'] as const satisfies readonly ReviewStatus[];
export const EXPERIENCES = ['zero', 'occasional', 'regular'] as const satisfies readonly TrainingExperience[];
export const ELIGIBILITY_CATEGORIES = ['project', 'review_status', 'safety', 'equipment', 'experience', 'alternative'] as const satisfies readonly EligibilityCategory[];
export const REGISTRY_VERSION = '1' as const;
export const EQUIPMENT_IDS = ['bodyweight', 'band_light', 'band_mid', 'dumbbell_1kg', 'dumbbell_1.5kg', 'dumbbell_2kg', 'dumbbell_3kg', 'dumbbell_4kg', 'dumbbell_5kg', 'mat_6mm', 'foam_roller_plain', 'yoga_ball_55'] as const satisfies readonly EquipmentId[];
export const MUSCLE_GROUPS = ['肱三头肌', '胸大肌', '臀大肌', '臀中肌', '腹横肌', '腹直肌', '斜方肌上束', '斜方肌中下束', '菱形肌', '股四头肌', '腘绳肌', '多肌群协同'] as const satisfies readonly MuscleGroup[];
export const DEFAULT_EQUIPMENT_IDS = EQUIPMENT_IDS;
export const INJURY_EXPANSION: Record<InjurySelection, InjuryTag[]> = {
  shoulder: ['shoulder_impingement', 'rotator_cuff'], neck: ['neck_pain'], elbow: ['elbow_pain'], wrist: ['wrist_pain'],
  back: ['lower_back', 'sciatica'], knee: ['knee_pain', 'meniscus'],
};
/**
 * Two-tier difficulty gating per experience level.
 *
 * `allowed`   – hard safety gate: exercises outside this range are never
 *               shown to this experience level (e.g. a zero-experience user
 *               must not get D3+ moves).
 * `preferred` – soft hint: when multiple eligible exercises exist, those
 *               within the preferred band are sorted first.  If the project
 *               only has easier exercises (e.g. trap_relax tops out at D2)
 *               the engine gracefully falls back to any allowed exercise
 *               rather than blocking with "no eligible exercises".
 */
export const EXPERIENCE_RANGE: Record<
  TrainingExperience,
  { readonly allowed: readonly [number, number]; readonly preferred: readonly [number, number] }
> = {
  zero:       { allowed: [1, 2], preferred: [1, 1] },
  occasional: { allowed: [1, 3], preferred: [2, 3] },
  regular:    { allowed: [1, 4], preferred: [3, 4] },
};
export const LEGACY_INJURY_MAP: Record<string, InjurySelection> = {
  shoulder_impingement: 'shoulder', rotator_cuff: 'shoulder', shoulder_pain: 'shoulder', neck_pain: 'neck',
  elbow_pain: 'elbow', wrist_pain: 'wrist', lower_back: 'back', sciatica: 'back', knee_pain: 'knee', meniscus: 'knee',
  肩: 'shoulder', 颈: 'neck', 颈部: 'neck', 肘: 'elbow', 腕: 'wrist', 手腕: 'wrist', 腰: 'back', 背: 'back', 膝: 'knee', 膝盖: 'knee',
};
export const LEGACY_EQUIPMENT_MAP: Record<string, string> = {
  none: 'bodyweight', bodyweight: 'bodyweight', resistance_band: 'band_light', band_light: 'band_light', band_mid: 'band_mid',
  'dumbbell_1kg_pair': 'dumbbell_1kg', 'dumbbell_1.5kg_pair': 'dumbbell_1.5kg', 'dumbbell_2kg_pair': 'dumbbell_2kg',
  'dumbbell_3kg_pair': 'dumbbell_3kg', 'dumbbell_4kg_pair': 'dumbbell_4kg', 'dumbbell_5kg_pair': 'dumbbell_5kg',
  mat: 'mat_6mm', mat_6mm: 'mat_6mm', foam_roller: 'foam_roller_plain', foam_roller_plain: 'foam_roller_plain', yoga_ball_55: 'yoga_ball_55',
};
/**
 * Parses the numeric kg weight out of a dumbbell equipment id (e.g.
 * "dumbbell_1.5kg" -> 1.5). Returns null for non-dumbbell equipment ids so
 * callers can fall back to exact-match comparison.
 */
export function parseDumbbellWeightKg(equipmentId: string): number | null {
  const match = /^dumbbell_(\d+(?:\.\d+)?)kg$/.exec(equipmentId);
  return match ? Number(match[1]) : null;
}
export const LEGACY_PROJECT_MAP: Record<string, ProjectId> = Object.fromEntries(PROJECT_IDS.map(id => [id, id])) as Record<string, ProjectId>;
export const isValue = <T extends readonly string[]>(values: T, value: unknown): value is T[number] => typeof value === 'string' && (values as readonly string[]).includes(value);

/**
 * True when the user's equipment satisfies one required equipment id.
 *
 * Dumbbells are "upward compatible": a user who only owns a heavier dumbbell
 * than the exercise calls for can still perform the move (a 2kg dumbbell can
 * always substitute for a 1kg one). Every other equipment id still requires
 * an exact match — a resistance band or yoga ball has no safe substitution
 * rule, so we never guess there.
 */
export function hasEquipmentFor(requiredId: string, ownedEquipment: readonly string[]): boolean {
  if (ownedEquipment.includes(requiredId)) return true;

  const requiredWeight = parseDumbbellWeightKg(requiredId);
  if (requiredWeight === null) return false;

  return ownedEquipment.some(owned => {
    const ownedWeight = parseDumbbellWeightKg(owned);
    return ownedWeight !== null && ownedWeight >= requiredWeight;
  });
}
