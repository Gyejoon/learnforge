import { describe, it, expect } from 'vitest';
import { buildLearningSession } from './modes.js';

describe('Learning Modes', () => {
  it('returns valid system prompt for each mode', () => {
    for (const mode of ['socratic','feynman','quiz','teach','explore','gap'] as const) {
      const result = buildLearningSession(mode, 'Kotlin Coroutines', 'context here');
      expect(result.systemPrompt.length).toBeGreaterThan(100);
      expect(result.mode).toBe(mode);
    }
  });
  it('socratic prompt contains question-related keywords', () => {
    const result = buildLearningSession('socratic', 'FSRS', 'context');
    expect(result.systemPrompt).toMatch(/질문|question/i);
  });
  it('includes topic in system prompt', () => {
    const result = buildLearningSession('feynman', 'FSRS Algorithm', 'context');
    expect(result.systemPrompt).toContain('FSRS Algorithm');
  });
  it('includes context in system prompt', () => {
    const result = buildLearningSession('explore', 'React', 'some learning context');
    expect(result.systemPrompt).toContain('some learning context');
  });
});
