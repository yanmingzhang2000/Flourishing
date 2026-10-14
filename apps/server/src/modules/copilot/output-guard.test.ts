import { describe, expect, it } from 'vitest';
import { guardCopilotOutput } from './output-guard';

const LIBRARY = ['墙面俯卧撑', '椅子臂屈伸', '哑铃反向飞鸟', '臀桥', '自重深蹲', '猫牛式'];

describe('guardCopilotOutput (deterministic safety layer)', () => {
  it('passes through text with no violations unchanged', () => {
    const text = '今天可以做自重深蹲和臀桥，注意保持核心收紧。';
    const result = guardCopilotOutput({
      text,
      contraindicatedNames: ['椅子臂屈伸'],
      libraryNames: LIBRARY,
      safeExerciseNames: ['自重深蹲', '臀桥'],
    });
    expect(result.safeText).toBe(text);
    expect(result.contraindicatedHits).toEqual([]);
    expect(result.inventedHits).toEqual([]);
  });

  it('removes contraindicated exercise names from the reply (P0 safety red line)', () => {
    const result = guardCopilotOutput({
      text: '你可以先做椅子臂屈伸来锻炼手臂，再做自重深蹲。',
      contraindicatedNames: ['椅子臂屈伸'],
      libraryNames: LIBRARY,
      safeExerciseNames: ['自重深蹲', '臀桥', '猫牛式'],
    });
    expect(result.contraindicatedHits).toEqual(['椅子臂屈伸']);
    expect(result.safeText).not.toContain('椅子臂屈伸');
    expect(result.safeText).toContain('自重深蹲');
    // Trailing safety note with safe alternatives
    expect(result.safeText).toContain('安全提示');
    expect(result.safeText).toContain('自重深蹲');
  });

  it('removes invented (non-library) exercises such as deadlift/bridge-leg-raise', () => {
    const result = guardCopilotOutput({
      text: '建议加入硬拉和桥式抬腿来强化后链，另外自重深蹲也不错。',
      contraindicatedNames: [],
      libraryNames: LIBRARY,
    });
    expect(result.inventedHits).toEqual(expect.arrayContaining(['硬拉', '桥式抬腿']));
    expect(result.safeText).not.toContain('硬拉');
    expect(result.safeText).not.toContain('桥式抬腿');
    expect(result.safeText).toContain('自重深蹲');
  });

  it('does not false-positive denylist terms that are substrings of real library names', () => {
    // "杠铃" is on the denylist; no library name contains it, but "飞鸟" is
    // a substring of "哑铃反向飞鸟". Masking real names first must prevent
    // a legit recommendation from being flagged.
    const text = '哑铃反向飞鸟是一个很好的后肩动作，可以加入你的计划。';
    const result = guardCopilotOutput({
      text,
      contraindicatedNames: [],
      libraryNames: LIBRARY,
    });
    expect(result.inventedHits).toEqual([]);
    expect(result.safeText).toBe(text);
  });

  it('handles both violation types in one reply', () => {
    const result = guardCopilotOutput({
      text: '先做椅子臂屈伸热身，然后做硬拉强化全身。',
      contraindicatedNames: ['椅子臂屈伸'],
      libraryNames: LIBRARY,
      safeExerciseNames: ['自重深蹲'],
    });
    expect(result.contraindicatedHits).toEqual(['椅子臂屈伸']);
    expect(result.inventedHits).toContain('硬拉');
    expect(result.safeText).not.toContain('椅子臂屈伸');
    expect(result.safeText).not.toContain('硬拉');
  });

  it('strips every occurrence of a contraindicated name (repeated mentions)', () => {
    const result = guardCopilotOutput({
      text: '椅子臂屈伸很好，椅子臂屈伸再做一组。',
      contraindicatedNames: ['椅子臂屈伸'],
      libraryNames: LIBRARY,
    });
    expect(result.safeText).not.toContain('椅子臂屈伸');
  });
});
