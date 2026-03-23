import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const CLI_PATH = path.resolve('dist/cli.js');
const TEST_DB = path.join(os.tmpdir(), `learnforge-cli-test-${Date.now()}.db`);

function runCli(args: string[]): string {
  return execFileSync('node', [CLI_PATH, '--db', TEST_DB, ...args], {
    encoding: 'utf-8',
    timeout: 10_000,
  }).trim();
}

describe('CLI', () => {
  it('--help로 도움말을 표시해야 한다', () => {
    const output = execFileSync('node', [CLI_PATH, '--help'], {
      encoding: 'utf-8',
    });
    expect(output).toContain('learnforge');
    expect(output).toContain('ingest');
    expect(output).toContain('review');
  });

  it('--version으로 버전을 표시해야 한다', () => {
    const output = execFileSync('node', [CLI_PATH, '--version'], {
      encoding: 'utf-8',
    }).trim();
    expect(output).toBe('0.1.0');
  });

  it('status로 시스템 상태를 JSON으로 반환해야 한다', () => {
    const output = runCli(['status']);
    const parsed = JSON.parse(output) as { total_sources: number; total_cards: number };
    expect(typeof parsed.total_sources).toBe('number');
    expect(typeof parsed.total_cards).toBe('number');
  });

  it('ingest로 텍스트를 수집해야 한다', () => {
    const output = runCli(['ingest', 'Test content for CLI']);
    const parsed = JSON.parse(output) as { source: { type: string } };
    expect(parsed.source.type).toBe('text');
  });

  it('sources로 수집된 자료를 조회해야 한다', () => {
    const output = runCli(['sources']);
    const parsed = JSON.parse(output) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('learn으로 학습 세션을 생성해야 한다', () => {
    const output = runCli(['learn', 'socratic', '--topic', 'FSRS']);
    const parsed = JSON.parse(output) as { mode_name: string; systemPrompt: string };
    expect(parsed.mode_name).toBe('socratic');
    expect(parsed.systemPrompt).toContain('FSRS');
  });

  it('learn에 잘못된 모드를 넣으면 에러를 반환해야 한다', () => {
    expect(() => runCli(['learn', 'invalid'])).toThrow();
  });

  it('review로 복습 카드를 조회해야 한다', () => {
    const output = runCli(['review']);
    const parsed = JSON.parse(output) as { due_count: number; new_count: number };
    expect(typeof parsed.due_count).toBe('number');
  });

  it('create-cards로 stdin에서 카드를 생성해야 한다', () => {
    const cardsJson = JSON.stringify([
      { front: 'CLI Q', back: 'CLI A', cardType: 'basic' },
    ]);
    const output = execFileSync(
      'node',
      [CLI_PATH, '--db', TEST_DB, 'create-cards'],
      { input: cardsJson, encoding: 'utf-8', timeout: 10_000 },
    ).trim();
    const parsed = JSON.parse(output) as Array<{ front: string }>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0].front).toBe('CLI Q');
  });

  it('progress로 통계를 조회해야 한다', () => {
    const output = runCli(['progress', '--type', 'overview']);
    const parsed = JSON.parse(output) as { total_cards: number };
    expect(typeof parsed.total_cards).toBe('number');
  });

  it('export --format tsv로 내보내기해야 한다', () => {
    const output = runCli(['export', '--format', 'tsv']);
    expect(output).toContain('front\tback\ttags\tdeck');
  });

  it('setup --help로 설정 도움말을 표시해야 한다', () => {
    const output = execFileSync('node', [CLI_PATH, 'setup', '--help'], {
      encoding: 'utf-8',
    });
    expect(output).toContain('Initialize LearnForge');
    expect(output).toContain('--target');
    expect(output).toContain('--skip-claude');
  });

  it('setup --skip-claude로 DB만 초기화해야 한다', () => {
    const output = runCli(['setup', '--skip-claude']);
    expect(output).toContain('[OK] Database');
    expect(output).toContain('skipped');
  });
});
