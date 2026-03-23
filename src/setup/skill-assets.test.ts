import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function readRepoFile(...segments: string[]): string {
  return fs.readFileSync(path.resolve(...segments), 'utf-8');
}

describe('LearnForge skill assets', () => {
  it('공용 원본을 렌더링하면 Claude/OpenClaw 배포 사본과 동일해야 한다', () => {
    const template = readRepoFile('skills', 'learnforge', 'SKILL.md');
    const rendered = template.replaceAll(
      '{{LEARNFORGE_BIN}}',
      '~/.learnforge/bin/learnforge',
    );

    expect(readRepoFile('.claude', 'skills', 'learnforge', 'SKILL.md')).toBe(rendered);
    expect(readRepoFile('plugin', 'skills', 'learnforge', 'SKILL.md')).toBe(rendered);
  });
});
