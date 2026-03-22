import { describe, it, expect, beforeEach } from 'vitest';
import { initDatabase } from '../storage/index.js';
import { LearnForgeHandlers } from './handlers.js';

function createInMemoryHandlers(): LearnForgeHandlers {
  const db = initDatabase(':memory:');
  return new LearnForgeHandlers(db);
}

describe('Core handlers (직접 import)', () => {
  let handlers: LearnForgeHandlers;

  beforeEach(() => {
    handlers = createInMemoryHandlers();
  });

  it('handleIngest로 텍스트를 수집하면 source와 stats를 반환해야 한다', async () => {
    const result = await handlers.handleIngest({
      source: 'FSRS is a spaced repetition algorithm.',
    });
    expect(result.source.id).toBeTruthy();
    expect(result.source.type).toBe('text');
    expect(result.stats.chunks).toBeGreaterThanOrEqual(1);
  });

  it('handleSources로 수집된 자료 목록을 조회해야 한다', async () => {
    await handlers.handleIngest({ source: 'Content A' });
    const sources = handlers.handleSources();
    expect(sources.length).toBe(1);
  });

  it('handleLearn으로 6가지 모드 세션을 생성해야 한다', () => {
    const modes = ['socratic', 'feynman', 'quiz', 'teach', 'explore', 'gap'] as const;
    for (const mode of modes) {
      const result = handlers.handleLearn({ mode, topic: 'test' });
      expect(result.mode_name).toBe(mode);
      expect(result.systemPrompt).toBeTruthy();
      expect(result.description).toBeTruthy();
      expect(result.principle).toBeTruthy();
    }
  });

  it('handleCreateCards로 카드를 생성하고 handleReview로 조회해야 한다', () => {
    const cards = handlers.handleCreateCards({
      cards: [{ front: 'Q', back: 'A', cardType: 'basic' }],
      deck: 'test-deck',
    });
    expect(cards).toHaveLength(1);
    expect(cards[0].deck).toBe('test-deck');

    const review = handlers.handleReview({ deck: 'test-deck' });
    expect(review.new_count).toBe(1);
  });

  it('handleAnswer로 카드 복습 후 상태가 갱신되어야 한다', () => {
    const [card] = handlers.handleCreateCards({
      cards: [{ front: 'Q', back: 'A', cardType: 'basic' }],
    });
    const result = handlers.handleAnswer({ cardId: card.id, rating: 3 });
    expect(result.new_stability).toBeGreaterThan(0);
    expect(result.next_due).toBeTruthy();
  });

  it('handleProgress로 overview 통계를 조회해야 한다', () => {
    handlers.handleCreateCards({
      cards: [{ front: 'Q', back: 'A', cardType: 'basic' }],
    });
    const result = handlers.handleProgress({ type: 'overview' }) as {
      total_cards: number;
      new_cards: number;
    };
    expect(result.total_cards).toBe(1);
    expect(result.new_cards).toBe(1);
  });

  it('handleExport로 TSV 형식을 내보내야 한다', () => {
    handlers.handleCreateCards({
      cards: [{ front: 'Q', back: 'A', cardType: 'basic' }],
    });
    const tsv = handlers.handleExport({ format: 'tsv' });
    expect(tsv).toContain('front\tback\ttags\tdeck');
    expect(tsv).toContain('Q');
  });

  it('getStatus로 시스템 상태를 조회해야 한다', () => {
    const status = handlers.getStatus() as {
      total_sources: number;
      total_cards: number;
      due_today: number;
    };
    expect(typeof status.total_sources).toBe('number');
    expect(typeof status.total_cards).toBe('number');
  });
});
