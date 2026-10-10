/**
 * Weekly scheduling (SAFE-02a): converts a user's selected training
 * weekdays into concrete calendar dates, enforcing the 48h recovery rule
 * across consecutive calendar days.
 *
 * ❗ Authoritative rule (DECISIONS.md §3, supersedes PRODUCT_LOGIC §3.1
 * 模式A/B描述): since every training day combines all selected target
 * projects into one session, the full target muscle group set is
 * trained on every training day. Therefore two training days on
 * consecutive calendar dates always violate the 48h rule (24h < 48h).
 *
 * Rule (SAFE-02a, PRODUCT_LOGIC §3.2 / DECISIONS.md §3):
 *   - If the user's selected weekdays contain consecutive calendar days,
 *     the scheduler marks every other one as a "recovery day" instead of
 *     a training day (隔天练 pattern), with the explicit reason recorded.
 *   - If all 7 days are selected, the scheduler forces an alternating
 *     train/recovery pattern across the full week.
 *
 * ❗ RED LINE (04-SAFETY_RULES.md §1.1): deterministic only, no LLM.
 */

import type { TrainingDay } from '@flourish/contracts';
import { MINIMUM_RECOVERY_HOURS } from './recovery';

const WEEKDAY_ORDER: TrainingDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export interface ScheduledDay {
  /** ISO date (YYYY-MM-DD) */
  date: string;
  /** Weekday name for this date */
  weekday: TrainingDay;
  /** true = actual training day, false = recovery/rest day */
  isTrainingDay: boolean;
  /** Explanation when a user-requested training day was converted to recovery */
  recoveryReason?: string;
}

/**
 * Build a 7-day calendar starting from `startDate`, mapping each date to
 * its weekday name.
 *
 * @param startDate - ISO date (YYYY-MM-DD) for day 0 of the week
 */
function buildWeekDates(startDate: string): { date: string; weekday: TrainingDay }[] {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  if (isNaN(start.getTime())) {
    throw new TypeError('Invalid ISO date for startDate');
  }

  const dates: { date: string; weekday: TrainingDay }[] = [];
  for (let i = 0; i < 7; i++) {
    const current = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const isoDate = current.toISOString().slice(0, 10);
    // getUTCDay(): 0=Sunday..6=Saturday. Map to WEEKDAY_ORDER (Monday-first).
    const dayIndex = current.getUTCDay();
    const weekday = WEEKDAY_ORDER[(dayIndex + 6) % 7]!;
    dates.push({ date: isoDate, weekday });
  }
  return dates;
}

/**
 * Build a 7-day schedule from the user's selected training weekdays,
 * enforcing the 48h recovery rule (SAFE-02a).
 *
 * Since every training day trains the full combined muscle-group set,
 * any two consecutive calendar days cannot both be training days. When
 * the user's selection would violate this, every other conflicting day
 * is converted to a recovery day (隔天练), preserving the user's
 * earliest preferred days where possible.
 *
 * @param startDate - ISO date (YYYY-MM-DD) for the first day of the week
 * @param selectedWeekdays - User-selected training weekdays (1-7 days)
 * @returns 7 ScheduledDay entries covering the full week
 */
export function buildWeeklySchedule(
  startDate: string,
  selectedWeekdays: readonly TrainingDay[],
): ScheduledDay[] {
  const weekDates = buildWeekDates(startDate);
  const selectedSet = new Set(selectedWeekdays);

  const result: ScheduledDay[] = weekDates.map(({ date, weekday }) => ({
    date,
    weekday,
    isTrainingDay: selectedSet.has(weekday),
  }));

  // Enforce 48h rule: scan consecutive calendar days and demote every
  // other conflicting training day to a recovery day.
  let lastTrainingIndex: number | null = null;
  for (let i = 0; i < result.length; i++) {
    const day = result[i]!;
    if (!day.isTrainingDay) continue;

    if (lastTrainingIndex !== null) {
      const hoursSinceLastTraining = (i - lastTrainingIndex) * 24;
      if (hoursSinceLastTraining < MINIMUM_RECOVERY_HOURS) {
        day.isTrainingDay = false;
        day.recoveryReason =
          '同肌群训练间隔需 ≥48 小时，已自动调整为主动恢复日（SAFE-02a）';
        continue; // do not update lastTrainingIndex; this day is now recovery
      }
    }

    lastTrainingIndex = i;
  }

  return result;
}

/**
 * Convenience check: does the given weekday selection include all 7 days?
 * Used to detect the "7天全选" case that triggers forced recovery
 * insertion (SAFE-02a).
 */
export function isFullWeekSelected(selectedWeekdays: readonly TrainingDay[]): boolean {
  return new Set(selectedWeekdays).size === 7;
}
