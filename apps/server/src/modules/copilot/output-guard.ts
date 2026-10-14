/**
 * Deterministic output guard for the Copilot channel (04-SAFETY §6:
 * AI faults/hallucinations must never bypass safety decisions).
 *
 * Prompt-level constraints in index.ts are soft - an LLM can still
 * recommend a contraindicated exercise (e.g. push-ups to a shoulder-injury
 * user) or invent exercises that do not exist in the library. This module
 * is the hard, deterministic layer that runs on the FULL assistant text
 * before it is streamed to the client or persisted:
 *
 *   1. Contraindicated exercise names (computed by the same rule engine
 *      as plan generation) are removed from the reply.
 *   2. Common non-library exercise terms (denylist) are removed, so the
 *      model cannot invent movements outside the approved library.
 *
 * Pure functions only - no I/O, fully unit-testable.
 */

export interface GuardInput {
  /** Full assistant reply text (already collected - not a stream). */
  text: string;
  /** Exercise names that are contraindicated for THIS user (from the rule engine). */
  contraindicatedNames: string[];
  /** ALL approved library names - used to mask legit names before denylist scanning. */
  libraryNames: string[];
  /** Safe exercise names for this user (injury + equipment filtered) - used in the trailing hint. */
  safeExerciseNames?: string[];
}

export interface GuardResult {
  /** Sanitized text safe to send/persist. */
  safeText: string;
  /** Contraindicated exercise names that were found and removed. */
  contraindicatedHits: string[];
  /** Non-library (invented) terms that were found and removed. */
  inventedHits: string[];
}

/**
 * Common exercises LLMs like to recommend that do NOT exist in the
 * Flourish library (data/exercise-library). Terms are matched only AFTER
 * all real library names have been masked in a scan copy, so a term that
 * happens to be a substring of a real exercise name never false-positives
 * on a legitimate recommendation.
 */
const NON_LIBRARY_DENYLIST: readonly string[] = [
  '硬拉',
  '罗马尼亚硬拉',
  '相扑硬拉',
  '卧推',
  '引体向上',
  '双杠臂屈伸',
  '蝴蝶机',
  '坐姿划船',
  '杠铃',
  '壶铃',
  '腿举',
  '哈克深蹲',
  '卷腹',
  '俄式转体',
  '桥式抬腿',
  '波比跳',
  '跳绳',
  '悬垂举腿',
  '山羊挺身',
  '罗马椅',
];

const CONTRAINDICATED_REPLACEMENT = '〔该动作不适合你的当前情况，已移除〕';
const INVENTED_REPLACEMENT = '〔该动作不在应用动作库中，已移除〕';

/** Replace every occurrence of each term in text with a fixed marker. */
function replaceAll(text: string, terms: readonly string[], replacement: string): string {
  let result = text;
  for (const term of terms) {
    if (term) result = result.split(term).join(replacement);
  }
  return result;
}

export function guardCopilotOutput(input: GuardInput): GuardResult {
  const { text, contraindicatedNames, libraryNames } = input;

  // 1) Contraindicated library names - must never reach the user.
  const contraindicatedHits = contraindicatedNames.filter((name) => text.includes(name));

  // 2) Invented terms: mask every REAL library name (safe + contraindicated)
  //    in a scan copy first (delete them), so substring denylist terms cannot
  //    match inside legitimate exercise names, then scan the rest.
  const masked = replaceAll(text, libraryNames, '<<L>>');
  const inventedHits = NON_LIBRARY_DENYLIST.filter((term) => masked.includes(term));

  if (contraindicatedHits.length === 0 && inventedHits.length === 0) {
    return { safeText: text, contraindicatedHits: [], inventedHits: [] };
  }

  let safeText = replaceAll(text, contraindicatedHits, CONTRAINDICATED_REPLACEMENT);
  safeText = replaceAll(safeText, inventedHits, INVENTED_REPLACEMENT);

  // Trailing explanation so the replacement markers read as intentional.
  const notes: string[] = [];
  if (contraindicatedHits.length > 0) {
    const alternatives = (input.safeExerciseNames ?? []).slice(0, 3);
    notes.push(
      alternatives.length > 0
        ? `安全提示：不适合你当前伤病的动作已被系统过滤。可选的安全动作：${alternatives.join('、')}。`
        : '安全提示：不适合你当前伤病的动作已被系统过滤。',
    );
  }
  if (inventedHits.length > 0) {
    notes.push('安全提示：不在应用动作库中的动作已被系统过滤，请从可用动作列表中选择。');
  }
  if (notes.length > 0) {
    safeText = safeText + '\n\n（' + notes.join(' ') + '）';
  }

  return { safeText, contraindicatedHits, inventedHits };
}
