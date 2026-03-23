import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as childProcess from 'child_process';
import {
  ensureLearnForgeWrapper,
  getLearnForgeWrapperPath,
  getOpenClawSkillPath,
  setupOpenClaw,
} from './openclaw.js';

vi.mock('fs');
vi.mock('os');
vi.mock('child_process');

const mockedFs = vi.mocked(fs);
const mockedOs = vi.mocked(os);
const mockedChildProcess = vi.mocked(childProcess);

beforeEach(() => {
  vi.resetAllMocks();
  mockedOs.homedir.mockReturnValue('/Users/testuser');
  mockedFs.existsSync.mockReturnValue(true);
  mockedFs.mkdirSync.mockImplementation(() => undefined);
  mockedFs.writeFileSync.mockImplementation(() => undefined);
  mockedFs.chmodSync.mockImplementation(() => undefined);
  mockedFs.readFileSync.mockReturnValue('# LearnForge skill template');
});

describe('OpenClaw setup helpers', () => {
  it('wrapper 경로는 ~/.learnforge/bin/learnforge 여야 한다', () => {
    expect(getLearnForgeWrapperPath()).toBe('/Users/testuser/.learnforge/bin/learnforge');
  });

  it('OpenClaw 스킬 경로는 ~/.openclaw/skills/learnforge/SKILL.md 여야 한다', () => {
    expect(getOpenClawSkillPath()).toBe(
      '/Users/testuser/.openclaw/skills/learnforge/SKILL.md',
    );
  });

  it('LearnForge wrapper 스크립트를 생성해야 한다', () => {
    const wrapperPath = ensureLearnForgeWrapper('/path/to/repo/dist/cli.js');

    expect(wrapperPath).toBe('/Users/testuser/.learnforge/bin/learnforge');
    expect(mockedFs.writeFileSync).toHaveBeenCalledOnce();
    expect(mockedFs.chmodSync).toHaveBeenCalledWith(wrapperPath, 0o755);
  });

  it('OpenClaw CLI가 없으면 경고 상태를 반환해야 한다', () => {
    mockedChildProcess.execFileSync.mockImplementation(() => {
      throw new Error('openclaw not found');
    });

    const result = setupOpenClaw({
      wrapperPath: '/Users/testuser/.learnforge/bin/learnforge',
      skillSourcePath: '/repo/skills/learnforge/SKILL.md',
    });

    expect(result.status).toBe('warning');
    expect(result.message).toContain('OpenClaw CLI');
  });

  it('OpenClaw CLI가 있으면 스킬을 설치하고 검증해야 한다', () => {
    mockedChildProcess.execFileSync.mockReturnValue('');

    const result = setupOpenClaw({
      wrapperPath: '/Users/testuser/.learnforge/bin/learnforge',
      skillSourcePath: '/repo/skills/learnforge/SKILL.md',
    });

    expect(result.status).toBe('configured');
    expect(result.skillPath).toBe('/Users/testuser/.openclaw/skills/learnforge/SKILL.md');
    expect(mockedFs.writeFileSync).toHaveBeenCalled();
    expect(mockedChildProcess.execFileSync).toHaveBeenCalledTimes(2);
  });
});
