#!/usr/bin/env node

import { Command } from 'commander';
import { LearnForgeHandlers } from './core/index.js';
import { createDatabase, resolveDbPath } from './core/index.js';
import { runSetup } from './setup/index.js';
import * as fs from 'fs';
import type { LearningMode, SessionState } from './types.js';
import { detectSourceType, extractText, extractMarkdown, extractCode, extractPdf, extractYoutube, extractUrl } from './ingestion/extractors.js';
import { formatAsMarkdown } from './ingestion/markdown-formatter.js';
import { saveMaterial } from './ingestion/materials.js';

// ── Lazy-init handlers ──────────────────────────────────────────────────

let _handlers: LearnForgeHandlers | null = null;

function getHandlers(): LearnForgeHandlers {
  if (_handlers === null) {
    const db = createDatabase(resolveDbPath());
    _handlers = new LearnForgeHandlers(db);
  }
  return _handlers;
}

function output(data: unknown, pretty: boolean): void {
  const json = pretty
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data);
  console.log(json);
}

// ── CLI program ─────────────────────────────────────────────────────────

const program = new Command();

program
  .name('learnforge')
  .version('0.1.0')
  .description('Local-first AI learning system with FSRS-6 spaced repetition')
  .option('--db <path>', 'Database path (default: ~/.learnforge/learnforge.db)')
  .hook('preAction', (thisCommand) => {
    const dbPath = thisCommand.opts().db as string | undefined;
    if (dbPath !== undefined) {
      process.env.LEARNFORGE_DB = dbPath;
    }
  });

// ── ingest ──────────────────────────────────────────────────────────────

program
  .command('ingest')
  .description('Ingest learning material (text, file path, URL, or YouTube link)')
  .argument('<source>', 'Source to ingest (text, file path, URL, or YouTube link)')
  .option('--title <title>', 'Optional title override')
  .option('--deck <deck>', 'Target deck name')
  .option('--pretty', 'Pretty-print JSON output', false)
  .action(async (source: string, opts: { title?: string; deck?: string; pretty: boolean }) => {
    const result = await getHandlers().handleIngest({
      source,
      title: opts.title,
      deck: opts.deck,
    });
    output(result, opts.pretty);
  });

// ── sources ─────────────────────────────────────────────────────────────

program
  .command('sources')
  .description('List all ingested sources')
  .option('--pretty', 'Pretty-print JSON output', false)
  .action((opts: { pretty: boolean }) => {
    const result = getHandlers().handleSources();
    output(result, opts.pretty);
  });

// ── learn ───────────────────────────────────────────────────────────────

program
  .command('learn')
  .description('Start a learning session with a specific pedagogy mode')
  .argument('<mode>', 'Learning mode: socratic|feynman|quiz|teach|explore|gap')
  .option('--topic <topic>', 'Topic to study')
  .option('--deck <deck>', 'Deck to study from')
  .option('--pretty', 'Pretty-print JSON output', false)
  .action((mode: string, opts: { topic?: string; deck?: string; pretty: boolean }) => {
    const validModes = ['socratic', 'feynman', 'quiz', 'teach', 'explore', 'gap'];
    if (!validModes.includes(mode)) {
      console.error(`Invalid mode: ${mode}. Must be one of: ${validModes.join(', ')}`);
      process.exit(1);
    }
    const result = getHandlers().handleLearn({
      mode: mode as LearningMode,
      topic: opts.topic,
      deck: opts.deck,
    });
    output(result, opts.pretty);
  });

// ── create-cards ────────────────────────────────────────────────────────

program
  .command('create-cards')
  .description('Create flashcards with FSRS initial state')
  .option('--file <path>', 'JSON file with cards array')
  .option('--source-id <id>', 'Source ID for the cards')
  .option('--deck <deck>', 'Target deck name')
  .option('--pretty', 'Pretty-print JSON output', false)
  .action((opts: { file?: string; sourceId?: string; deck?: string; pretty: boolean }) => {
    let cardsData: string;

    if (opts.file !== undefined) {
      cardsData = fs.readFileSync(opts.file, 'utf-8');
    } else {
      // Read from stdin
      cardsData = fs.readFileSync(0, 'utf-8');
    }

    const parsed = JSON.parse(cardsData) as Array<{
      front: string;
      back: string;
      cardType: string;
      tags?: string;
    }>;

    const result = getHandlers().handleCreateCards({
      cards: parsed,
      sourceId: opts.sourceId,
      deck: opts.deck,
    });
    output(result, opts.pretty);
  });

// ── review ──────────────────────────────────────────────────────────────

program
  .command('review')
  .description('Get cards due for review')
  .option('--deck <deck>', 'Filter by deck')
  .option('--limit <n>', 'Maximum number of cards', parseInt)
  .option('--pretty', 'Pretty-print JSON output', false)
  .action((opts: { deck?: string; limit?: number; pretty: boolean }) => {
    const result = getHandlers().handleReview({
      deck: opts.deck,
      limit: opts.limit,
    });
    output(result, opts.pretty);
  });

// ── answer ──────────────────────────────────────────────────────────────

program
  .command('answer')
  .description('Submit a review answer for a card')
  .argument('<cardId>', 'Card ID to review')
  .argument('<rating>', 'Rating: 1=Again, 2=Hard, 3=Good, 4=Easy')
  .option('--pretty', 'Pretty-print JSON output', false)
  .action((cardId: string, ratingStr: string, opts: { pretty: boolean }) => {
    const rating = parseInt(ratingStr, 10);
    if (![1, 2, 3, 4].includes(rating)) {
      console.error(`Invalid rating: ${ratingStr}. Must be 1, 2, 3, or 4.`);
      process.exit(1);
    }
    const result = getHandlers().handleAnswer({
      cardId,
      rating: rating as 1 | 2 | 3 | 4,
    });
    output(result, opts.pretty);
  });

// ── progress ────────────────────────────────────────────────────────────

program
  .command('progress')
  .description('View learning progress statistics')
  .option('--type <type>', 'Stats type: overview|deck|heatmap|gaps|forecast', 'overview')
  .option('--deck <deck>', 'Filter by deck')
  .option('--days <n>', 'Number of days for heatmap/forecast', parseInt)
  .option('--pretty', 'Pretty-print JSON output', false)
  .action((opts: { type: string; deck?: string; days?: number; pretty: boolean }) => {
    const validTypes = ['overview', 'deck', 'heatmap', 'gaps', 'forecast'];
    if (!validTypes.includes(opts.type)) {
      console.error(`Invalid type: ${opts.type}. Must be one of: ${validTypes.join(', ')}`);
      process.exit(1);
    }
    const result = getHandlers().handleProgress({
      type: opts.type as 'overview' | 'deck' | 'heatmap' | 'gaps' | 'forecast',
      deck: opts.deck,
      days: opts.days,
    });
    output(result, opts.pretty);
  });

// ── export ──────────────────────────────────────────────────────────────

program
  .command('export')
  .description('Export flashcards in various formats')
  .requiredOption('--format <format>', 'Export format: tsv|csv|json|mochi_md')
  .option('--deck <deck>', 'Filter by deck')
  .action((opts: { format: string; deck?: string }) => {
    const validFormats = ['tsv', 'csv', 'json', 'mochi_md'];
    if (!validFormats.includes(opts.format)) {
      console.error(`Invalid format: ${opts.format}. Must be one of: ${validFormats.join(', ')}`);
      process.exit(1);
    }
    const result = getHandlers().handleExport({
      format: opts.format as 'tsv' | 'csv' | 'json' | 'mochi_md',
      deck: opts.deck,
    });
    // Export outputs raw content (not wrapped in JSON)
    console.log(result);
  });

// ── status ──────────────────────────────────────────────────────────────

program
  .command('status')
  .description('Show system status overview')
  .option('--pretty', 'Pretty-print JSON output', false)
  .action((opts: { pretty: boolean }) => {
    const result = getHandlers().getStatus();
    output(result, opts.pretty);
  });

// ── session ────────────────────────────────────────────────────────────

const session = program
  .command('session')
  .description('Manage learning session state');

session
  .command('list')
  .description('List saved sessions')
  .option('--status <status>', 'Filter by status: active|completed|abandoned')
  .option('--pretty', 'Pretty-print JSON output', false)
  .action((opts: { status?: string; pretty: boolean }) => {
    const result = getHandlers().handleSessionList(opts.status);
    output(result, opts.pretty);
  });

session
  .command('load')
  .description('Load a session by ID or get most recent active session')
  .argument('[sessionId]', 'Session ID (optional, defaults to most recent active)')
  .option('--mode <mode>', 'Filter by learning mode')
  .option('--topic <topic>', 'Filter by topic')
  .option('--pretty', 'Pretty-print JSON output', false)
  .action((sessionId: string | undefined, opts: { mode?: string; topic?: string; pretty: boolean }) => {
    const result = getHandlers().handleSessionLoad(
      sessionId,
      opts.mode as LearningMode | undefined,
      opts.topic,
    );
    if (result === null) {
      output({ error: 'No active session found' }, opts.pretty);
      process.exit(1);
    }
    output(result, opts.pretty);
  });

session
  .command('save')
  .description('Save session state from JSON file or stdin')
  .option('--file <path>', 'JSON file with session state')
  .option('--pretty', 'Pretty-print JSON output', false)
  .action((opts: { file?: string; pretty: boolean }) => {
    let stateData: string;
    if (opts.file !== undefined) {
      stateData = fs.readFileSync(opts.file, 'utf-8');
    } else {
      stateData = fs.readFileSync(0, 'utf-8');
    }
    const state = JSON.parse(stateData) as SessionState;
    getHandlers().handleSessionSave(state);
    output({ saved: true, sessionId: state.sessionId }, opts.pretty);
  });

session
  .command('delete')
  .description('Delete a saved session')
  .argument('<sessionId>', 'Session ID to delete')
  .option('--pretty', 'Pretty-print JSON output', false)
  .action((sessionId: string, opts: { pretty: boolean }) => {
    const deleted = getHandlers().handleSessionDelete(sessionId);
    output({ deleted, sessionId }, opts.pretty);
  });

// ── convert ────────────────────────────────────────────────────────────

program
  .command('convert')
  .description('Convert a source to markdown without ingesting into DB')
  .argument('<source>', 'Source to convert (file path, URL, or YouTube link)')
  .option('--title <title>', 'Title for the markdown file')
  .option('--output <path>', 'Output file path (default: ~/.learnforge/materials/)')
  .option('--pretty', 'Pretty-print JSON output', false)
  .action(async (source: string, opts: { title?: string; output?: string; pretty: boolean }) => {
    const sourceType = detectSourceType(source);

    let content: string;
    switch (sourceType) {
      case 'pdf': content = await extractPdf(source); break;
      case 'markdown': content = await extractMarkdown(source); break;
      case 'code': content = await extractCode(source); break;
      case 'youtube': content = await extractYoutube(source); break;
      case 'url': content = await extractUrl(source); break;
      default: content = await extractText(source); break;
    }

    const title = opts.title ?? source.split(/[/\\]/).pop() ?? 'Untitled';
    const mdContent = formatAsMarkdown(content, {
      title,
      source,
      type: sourceType,
      ingested: new Date().toISOString(),
    });

    let outputPath: string;
    if (opts.output !== undefined) {
      fs.writeFileSync(opts.output, mdContent, 'utf-8');
      outputPath = opts.output;
    } else {
      const id = crypto.randomUUID();
      outputPath = saveMaterial(id, mdContent);
    }

    output({ path: outputPath, title, type: sourceType }, opts.pretty);
  });

// ── setup ─────────────────────────────────────────────────────────────

program
  .command('setup')
  .description('Initialize LearnForge: create database and configure Claude Desktop')
  .option('--skip-claude', 'Skip Claude Desktop config injection', false)
  .action((opts: { skipClaude: boolean }) => {
    try {
      const dbPath = program.opts().db as string | undefined;
      const result = runSetup({
        dbPath,
        skipClaude: opts.skipClaude,
      });

      console.log('\n  LearnForge Setup\n');
      console.log(`  [OK] Node.js ${result.nodeVersion}`);
      console.log(`  [OK] Database: ${result.dbPath}`);

      if (result.claudeConfig) {
        console.log(
          `  [OK] Claude Desktop config ${result.claudeConfig.action}: ${result.claudeConfig.configPath}`,
        );
      } else {
        console.log('  [--] Claude Desktop config: skipped');
      }

      console.log('\n  Ready! Restart Claude Desktop to activate.\n');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\n  [!!] ${message}\n`);
      process.exit(1);
    }
  });

// ── Parse ───────────────────────────────────────────────────────────────

program.parse();
