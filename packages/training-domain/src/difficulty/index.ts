export type Difficulty = 1 | 2 | 3 | 4 | 5;

export type DifficultyFeedback = 'too_hard' | 'just_right' | 'too_easy';

export function clampDifficulty(value: number): Difficulty {
  if (!Number.isFinite(value)) {
    throw new RangeError('Difficulty must be a finite number');
  }
  const rounded = Math.round(value);
  if (rounded < 1) return 1;
  if (rounded > 5) return 5;
  return rounded as Difficulty;
}

export function adjustDifficulty(
  current: Difficulty,
  feedback: DifficultyFeedback,
): Difficulty {
  if (feedback === 'too_hard') return clampDifficulty(current - 1);
  if (feedback === 'too_easy') return clampDifficulty(current + 1);
  return current;
}
