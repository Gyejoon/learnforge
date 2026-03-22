import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import type Database from 'better-sqlite3';

import {
  initDatabase,
  getAllSources,
  insertCard,
  getCardById,
  updateCard,
  getDueCards,
  getNewCards,
  getAllCards,
  insertReview,
} from './storage/index.js';
import { FSRSEngine } from './fsrs/engine.js';
import { ingest } from './ingestion/pipeline.js';
import { buildLearningSession } from './learning/modes.js';
import { CardState, Rating } from './types.js';
import type { Card, LearningMode, CardType, Review } from './types.js';

// ── Handler interfaces ──────────────────────────────────────────────────────

export interface IngestInput {
  source: string;
  title?: string;
  deck?: string;
}

export interface IngestOutput {
  source: { id: string; title: string; type: string };
  stats: { chunks: number; totalTokens: number };
}

export interface LearnInput {
  mode: LearningMode;
  topic?: string;
  deck?: string;
}

export interface LearnOutput {
  systemPrompt: string;
  mode_name: string;
  description: string;
  principle: string;
}

export interface CreateCardsInput {
  cards: Array<{
    front: string;
    back: string;
    cardType: string;
    tags?: string;
  }>;
  sourceId?: string;
  deck?: string;
}

export interface ReviewOutput {
  due_count: number;
  new_count: number;
  cards: Card[];
}

export interface AnswerInput {
  cardId: string;
  rating: 1 | 2 | 3 | 4;
}

export interface AnswerOutput {
  next_due: string;
  interval: number;
  new_stability: number;
}

export interface ProgressInput {
  type?: 'overview' | 'deck' | 'heatmap' | 'gaps' | 'forecast';
  deck?: string;
  days?: number;
}

export interface ProgressOverview {
  total_cards: number;
  reviewed_today: number;
  retention_rate: number;
  due_today: number;
  new_cards: number;
  total_reviews: number;
}

export interface ExportInput {
  deck?: string;
  format: 'tsv' | 'csv' | 'json' | 'mochi_md';
}

// ── Mode metadata ──────────────────────────────────────────────────────────

const MODE_METADATA: Record<
  LearningMode,
  { description: string; principle: string }
> = {
  socratic: {
    description: '소크라테스식 대화로 스스로 답을 발견하는 학습',
    principle: 'Socratic Method — guided discovery through questions',
  },
  feynman: {
    description: '자신의 말로 설명하며 깊이 이해하는 학습',
    principle: 'Feynman Technique — teach to truly understand',
  },
  quiz: {
    description: '적응형 퀴즈로 지식을 검증하는 학습',
    principle: 'Retrieval Practice — testing effect for retention',
  },
  teach: {
    description: 'AI 학생에게 가르치며 이해를 강화하는 학습',
    principle: 'Protégé Effect — teaching reinforces learning',
  },
  explore: {
    description: '자유로운 탐구와 심층 Q&A 학습',
    principle: 'Elaboration & Organization — deep exploration',
  },
  gap: {
    description: '지식 격차를 진단하고 분석하는 학습',
    principle: 'Metacognition & Calibration — know what you don\'t know',
  },
};

// ── LearnForgeHandlers ────────────────────────────────────────────────────

export class LearnForgeHandlers {
  private readonly db: Database.Database;
  private readonly fsrs: FSRSEngine;

  constructor(db: Database.Database) {
    this.db = db;
    this.fsrs = new FSRSEngine();
  }

  async handleIngest(input: IngestInput): Promise<IngestOutput> {
    const result = await ingest(input.source, this.db, {
      title: input.title,
      deck: input.deck,
    });
    return {
      source: {
        id: result.source.id,
        title: result.source.title,
        type: result.source.type,
      },
      stats: {
        chunks: result.chunks.length,
        totalTokens: result.totalTokens,
      },
    };
  }

  handleSources(): ReturnType<typeof getAllSources> {
    return getAllSources(this.db);
  }

  handleLearn(input: LearnInput): LearnOutput {
    const topic = input.topic ?? input.deck ?? 'General';
    const context = `Learning mode: ${input.mode}. Topic: ${topic}.`;
    const session = buildLearningSession(input.mode, topic, context);
    const meta = MODE_METADATA[input.mode];
    return {
      systemPrompt: session.systemPrompt,
      mode_name: input.mode,
      description: meta.description,
      principle: meta.principle,
    };
  }

  handleCreateCards(input: CreateCardsInput): Card[] {
    const now = new Date().toISOString();
    const deck = input.deck ?? 'default';
    const sourceId = input.sourceId ?? 'manual';

    // Ensure a placeholder source exists when using 'manual' sourceId
    if (sourceId === 'manual') {
      const existing = this.db
        .prepare('SELECT id FROM sources WHERE id = ?')
        .get('manual');
      if (!existing) {
        this.db
          .prepare(
            `INSERT INTO sources (id, title, type, original_path, content_hash, metadata, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            'manual',
            'Manual Cards',
            'text',
            'manual',
            'manual',
            '{}',
            now,
          );
      }
    }

    const created: Card[] = [];
    for (const cardInput of input.cards) {
      const card: Card = {
        id: crypto.randomUUID(),
        sourceId,
        chunkId: null,
        deck,
        front: cardInput.front,
        back: cardInput.back,
        cardType: cardInput.cardType as CardType,
        tags: cardInput.tags ?? '',
        difficulty: 0,
        stability: 0,
        retrievability: 0,
        state: CardState.New,
        due: now,
        lastReview: null,
        reps: 0,
        lapses: 0,
        createdAt: now,
      };
      insertCard(this.db, card);
      created.push(card);
    }
    return created;
  }

  handleReview(input: { deck?: string; limit?: number }): ReviewOutput {
    const now = new Date().toISOString();
    const dueCards = getDueCards(this.db, now, input.deck, input.limit);
    const newLimit =
      input.limit !== undefined
        ? Math.max(0, input.limit - dueCards.length)
        : undefined;
    const newCards = getNewCards(this.db, input.deck, newLimit);
    const cards = [...dueCards, ...newCards];
    return {
      due_count: dueCards.length,
      new_count: newCards.length,
      cards,
    };
  }

  handleAnswer(input: AnswerInput): AnswerOutput {
    const card = getCardById(this.db, input.cardId);
    if (card === null) {
      throw new Error(`Card not found: ${input.cardId}`);
    }

    const rating = input.rating as Rating;
    const now = new Date();
    const result = this.fsrs.schedule(card, rating, now);

    updateCard(this.db, result.card);

    const review: Review = {
      id: crypto.randomUUID(),
      ...result.review,
    };
    insertReview(this.db, review);

    const dueDate = new Date(result.card.due);
    const intervalDays = Math.round(
      (dueDate.getTime() - now.getTime()) / 86400_000,
    );

    return {
      next_due: result.card.due,
      interval: intervalDays,
      new_stability: result.card.stability,
    };
  }

  handleProgress(input: ProgressInput): ProgressOverview | Record<string, unknown> {
    const type = input.type ?? 'overview';

    if (type === 'overview') {
      return this.getOverview(input.deck);
    }
    if (type === 'deck') {
      return this.getDeckStats(input.deck);
    }
    if (type === 'heatmap') {
      return this.getHeatmap(input.days ?? 30);
    }
    if (type === 'gaps') {
      return this.getGaps();
    }
    if (type === 'forecast') {
      return this.getForecast(input.days ?? 7);
    }
    return this.getOverview(input.deck);
  }

  private getOverview(deck?: string): ProgressOverview {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).toISOString();
    const nowStr = now.toISOString();

    let cardCountSql = 'SELECT COUNT(*) as count FROM cards';
    const cardCountParams: string[] = [];
    if (deck !== undefined) {
      cardCountSql += ' WHERE deck = ?';
      cardCountParams.push(deck);
    }
    const totalRow = this.db
      .prepare(cardCountSql)
      .get(...cardCountParams) as { count: number };
    const totalCards = totalRow.count;

    let reviewTodaySql =
      'SELECT COUNT(*) as count FROM reviews WHERE reviewed_at >= ?';
    const reviewTodayParams: string[] = [todayStart];
    if (deck !== undefined) {
      reviewTodaySql +=
        ' AND card_id IN (SELECT id FROM cards WHERE deck = ?)';
      reviewTodayParams.push(deck);
    }
    const reviewedTodayRow = this.db
      .prepare(reviewTodaySql)
      .get(...reviewTodayParams) as { count: number };
    const reviewedToday = reviewedTodayRow.count;

    let retentionSql =
      'SELECT COUNT(*) as count FROM reviews WHERE rating >= 3';
    let totalReviewsSql = 'SELECT COUNT(*) as count FROM reviews';
    const retentionParams: string[] = [];
    const totalReviewsParams: string[] = [];
    if (deck !== undefined) {
      retentionSql +=
        ' AND card_id IN (SELECT id FROM cards WHERE deck = ?)';
      retentionParams.push(deck);
      totalReviewsSql +=
        ' WHERE card_id IN (SELECT id FROM cards WHERE deck = ?)';
      totalReviewsParams.push(deck);
    }
    const goodReviewsRow = this.db
      .prepare(retentionSql)
      .get(...retentionParams) as { count: number };
    const totalReviewsRow = this.db
      .prepare(totalReviewsSql)
      .get(...totalReviewsParams) as { count: number };
    const totalReviews = totalReviewsRow.count;
    const retentionRate =
      totalReviews > 0
        ? Math.round((goodReviewsRow.count / totalReviews) * 100) / 100
        : 0;

    const dueCards = getDueCards(this.db, nowStr, deck);
    const newCards = getNewCards(this.db, deck);

    return {
      total_cards: totalCards,
      reviewed_today: reviewedToday,
      retention_rate: retentionRate,
      due_today: dueCards.length,
      new_cards: newCards.length,
      total_reviews: totalReviews,
    };
  }

  private getDeckStats(deck?: string): Record<string, unknown> {
    interface DeckRow {
      deck: string;
      total: number;
      new_count: number;
      learning_count: number;
      review_count: number;
    }

    let sql = `
      SELECT
        deck,
        COUNT(*) as total,
        SUM(CASE WHEN state = 0 THEN 1 ELSE 0 END) as new_count,
        SUM(CASE WHEN state IN (1, 3) THEN 1 ELSE 0 END) as learning_count,
        SUM(CASE WHEN state = 2 THEN 1 ELSE 0 END) as review_count
      FROM cards
    `;
    const params: string[] = [];
    if (deck !== undefined) {
      sql += ' WHERE deck = ?';
      params.push(deck);
    }
    sql += ' GROUP BY deck ORDER BY deck';

    const rows = this.db.prepare(sql).all(...params) as DeckRow[];
    return { decks: rows };
  }

  private getHeatmap(days: number): Record<string, unknown> {
    interface HeatmapRow {
      date: string;
      count: number;
    }
    const cutoff = new Date(
      Date.now() - days * 86400_000,
    ).toISOString();
    const rows = this.db
      .prepare(
        `SELECT substr(reviewed_at, 1, 10) as date, COUNT(*) as count
         FROM reviews WHERE reviewed_at >= ?
         GROUP BY date ORDER BY date`,
      )
      .all(cutoff) as HeatmapRow[];
    return { heatmap: rows, days };
  }

  private getGaps(): Record<string, unknown> {
    interface GapRow {
      deck: string;
      avg_difficulty: number;
      avg_retention: number;
      lapsed: number;
    }
    const rows = this.db
      .prepare(
        `SELECT
           deck,
           AVG(difficulty) as avg_difficulty,
           AVG(retrievability) as avg_retention,
           SUM(lapses) as lapsed
         FROM cards GROUP BY deck ORDER BY avg_retention ASC`,
      )
      .all() as GapRow[];
    return { gaps: rows };
  }

  private getForecast(days: number): Record<string, unknown> {
    interface ForecastRow {
      date: string;
      count: number;
    }
    const rows: ForecastRow[] = [];
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const dayStart = new Date(now.getTime() + i * 86400_000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 86400_000);
      const countRow = this.db
        .prepare(
          `SELECT COUNT(*) as count FROM cards
           WHERE due >= ? AND due < ? AND state != 0`,
        )
        .get(dayStart.toISOString(), dayEnd.toISOString()) as { count: number };
      rows.push({
        date: dayStart.toISOString().slice(0, 10),
        count: countRow.count,
      });
    }
    return { forecast: rows, days };
  }

  handleExport(input: ExportInput): string {
    // For JSON format, use getAllCards which returns properly typed Card objects with camelCase
    if (input.format === 'json') {
      const cards = getAllCards(this.db, input.deck);
      return JSON.stringify(cards, null, 2);
    }

    // For TSV, CSV, and Mochi Markdown, use raw SQL to pick specific columns
    let sql = 'SELECT * FROM cards';
    const params: string[] = [];
    if (input.deck !== undefined) {
      sql += ' WHERE deck = ?';
      params.push(input.deck);
    }
    sql += ' ORDER BY created_at ASC';

    interface CardRow {
      front: string;
      back: string;
      card_type: string;
      tags: string;
      deck: string;
      id: string;
    }
    const rows = this.db.prepare(sql).all(...params) as CardRow[];

    switch (input.format) {
      case 'tsv':
        return (
          'front\tback\ttags\tdeck\n' +
          rows
            .map((r) => `${r.front}\t${r.back}\t${r.tags}\t${r.deck}`)
            .join('\n')
        );

      case 'csv':
        return (
          '"front","back","tags","deck"\n' +
          rows
            .map(
              (r) =>
                `"${r.front.replace(/"/g, '""')}","${r.back.replace(/"/g, '""')}","${r.tags}","${r.deck}"`,
            )
            .join('\n')
        );

      case 'mochi_md': {
        const cards = rows
          .map((r) => `# ${r.front}\n\n${r.back}`)
          .join('\n\n---\n\n');
        return `<!-- LearnForge export -->\n\n${cards}`;
      }

      default:
        throw new Error(`Unsupported format: ${String(input.format)}`);
    }
  }

  getStatus(): Record<string, unknown> {
    const now = new Date().toISOString();
    const sourcesRow = this.db
      .prepare('SELECT COUNT(*) as count FROM sources')
      .get() as { count: number };
    const cardsRow = this.db
      .prepare('SELECT COUNT(*) as count FROM cards')
      .get() as { count: number };
    const dueCards = getDueCards(this.db, now);
    const newCards = getNewCards(this.db);
    return {
      total_sources: sourcesRow.count,
      total_cards: cardsRow.count,
      due_today: dueCards.length + newCards.length,
    };
  }

  getDueCardsList(): Card[] {
    const now = new Date().toISOString();
    const due = getDueCards(this.db, now);
    const newCards = getNewCards(this.db);
    return [...due, ...newCards];
  }
}

// ── Server factory ────────────────────────────────────────────────────────

export function createServer(dbPath: string): McpServer {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = initDatabase(dbPath);
  const handlers = new LearnForgeHandlers(db);

  const server = new McpServer({
    name: 'learnforge',
    version: '0.1.0',
  });

  // ── Tool: learnforge_ingest ──────────────────────────────────────────────
  server.tool(
    'learnforge_ingest',
    'Ingest learning material (text, file path, URL, or YouTube link)',
    {
      source: z.string().describe('The source to ingest'),
      title: z.string().optional().describe('Optional title override'),
      deck: z.string().optional().describe('Target deck name'),
    },
    async ({ source, title, deck }) => {
      const result = await handlers.handleIngest({ source, title, deck });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── Tool: learnforge_sources ─────────────────────────────────────────────
  server.tool(
    'learnforge_sources',
    'List all ingested sources',
    {},
    () => {
      const sources = handlers.handleSources();
      return {
        content: [
          { type: 'text', text: JSON.stringify(sources, null, 2) },
        ],
      };
    },
  );

  // ── Tool: learnforge_learn ───────────────────────────────────────────────
  server.tool(
    'learnforge_learn',
    'Start a learning session with a specific pedagogy mode',
    {
      mode: z
        .enum(['socratic', 'feynman', 'quiz', 'teach', 'explore', 'gap'])
        .describe('Learning mode'),
      topic: z.string().optional().describe('Topic to study'),
      deck: z.string().optional().describe('Deck to study from'),
    },
    ({ mode, topic, deck }) => {
      const result = handlers.handleLearn({ mode, topic, deck });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── Tool: learnforge_create_cards ────────────────────────────────────────
  server.tool(
    'learnforge_create_cards',
    'Create flashcards with FSRS initial state',
    {
      cards: z
        .array(
          z.object({
            front: z.string(),
            back: z.string(),
            cardType: z.string(),
            tags: z.string().optional(),
          }),
        )
        .describe('Cards to create'),
      sourceId: z.string().optional().describe('Source ID for the cards'),
      deck: z.string().optional().describe('Target deck name'),
    },
    ({ cards, sourceId, deck }) => {
      const created = handlers.handleCreateCards({ cards, sourceId, deck });
      return {
        content: [{ type: 'text', text: JSON.stringify(created, null, 2) }],
      };
    },
  );

  // ── Tool: learnforge_review ──────────────────────────────────────────────
  server.tool(
    'learnforge_review',
    'Get cards due for review',
    {
      deck: z.string().optional().describe('Filter by deck'),
      limit: z.number().optional().describe('Maximum number of cards'),
    },
    ({ deck, limit }) => {
      const result = handlers.handleReview({ deck, limit });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── Tool: learnforge_answer ──────────────────────────────────────────────
  server.tool(
    'learnforge_answer',
    'Submit a review answer for a card (rating: 1=Again, 2=Hard, 3=Good, 4=Easy)',
    {
      cardId: z.string().describe('The card ID to review'),
      rating: z
        .union([
          z.literal(1),
          z.literal(2),
          z.literal(3),
          z.literal(4),
        ])
        .describe('Rating: 1=Again, 2=Hard, 3=Good, 4=Easy'),
    },
    ({ cardId, rating }) => {
      const result = handlers.handleAnswer({ cardId, rating });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── Tool: learnforge_progress ────────────────────────────────────────────
  server.tool(
    'learnforge_progress',
    'View learning progress statistics',
    {
      type: z
        .enum(['overview', 'deck', 'heatmap', 'gaps', 'forecast'])
        .optional()
        .describe('Stats type (default: overview)'),
      deck: z.string().optional().describe('Filter by deck'),
      days: z
        .number()
        .optional()
        .describe('Number of days for heatmap/forecast'),
    },
    ({ type, deck, days }) => {
      const result = handlers.handleProgress({ type, deck, days });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ── Tool: learnforge_export ──────────────────────────────────────────────
  server.tool(
    'learnforge_export',
    'Export flashcards in various formats',
    {
      deck: z.string().optional().describe('Filter by deck'),
      format: z
        .enum(['tsv', 'csv', 'json', 'mochi_md'])
        .describe('Export format'),
    },
    ({ deck, format }) => {
      const content = handlers.handleExport({ deck, format });
      return {
        content: [{ type: 'text', text: content }],
      };
    },
  );

  // ── Resource: learnforge://status ────────────────────────────────────────
  server.resource(
    'learnforge-status',
    'learnforge://status',
    { description: 'LearnForge system status overview' },
    () => {
      const status = handlers.getStatus();
      return {
        contents: [
          {
            uri: 'learnforge://status',
            mimeType: 'application/json',
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    },
  );

  // ── Resource: learnforge://due-cards ────────────────────────────────────
  server.resource(
    'learnforge-due-cards',
    'learnforge://due-cards',
    { description: "Today's cards due for review" },
    () => {
      const cards = handlers.getDueCardsList();
      return {
        contents: [
          {
            uri: 'learnforge://due-cards',
            mimeType: 'application/json',
            text: JSON.stringify(cards, null, 2),
          },
        ],
      };
    },
  );

  return server;
}

// ── Main entry point ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  const dbPath =
    process.env.LEARNFORGE_DB ??
    path.join(os.homedir(), '.learnforge', 'learnforge.db');
  const server = createServer(dbPath);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const isMainModule =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('mcp-server.js') ||
    process.argv[1].endsWith('mcp-server.ts'));

if (isMainModule) {
  main().catch(console.error);
}
