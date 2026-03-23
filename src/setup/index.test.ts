import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkNodeVersion, runSetup } from './index.js';

vi.mock('../core/index.js', () => ({
  resolveDbPath: () => '/Users/testuser/.learnforge/learnforge.db',
  createDatabase: vi.fn(() => ({ close: vi.fn() })),
}));

vi.mock('./claude-config.js', () => ({
  getClaudeDesktopConfigPath: () =>
    '/Users/testuser/Library/Application Support/Claude/claude_desktop_config.json',
  getMcpServerPath: () => '/path/to/dist/mcp-server.js',
  injectClaudeDesktopConfig: vi.fn(() => ({
    configPath:
      '/Users/testuser/Library/Application Support/Claude/claude_desktop_config.json',
    action: 'created' as const,
  })),
}));

vi.mock('./openclaw.js', () => ({
  getLearnForgeCliPath: vi.fn(() => '/path/to/dist/cli.js'),
  getSkillSourcePath: vi.fn(() => '/repo/skills/learnforge/SKILL.md'),
  ensureLearnForgeWrapper: vi.fn(() => '/Users/testuser/.learnforge/bin/learnforge'),
  setupOpenClaw: vi.fn(() => ({
    status: 'configured' as const,
    skillPath: '/Users/testuser/.openclaw/skills/learnforge/SKILL.md',
    message: 'OpenClaw skill installed.',
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkNodeVersion', () => {
  it('Node.js 버전이 20 이상이면 에러를 던지지 않아야 한다', () => {
    expect(() => checkNodeVersion()).not.toThrow();
  });
});

describe('runSetup', () => {
  it('skipClaude가 true이면 claudeConfig가 null이어야 한다', () => {
    const result = runSetup({ skipClaude: true });
    expect(result.platforms.claude.status).toBe('skipped');
    expect(result.platforms.openclaw.status).toBe('skipped');
    expect(result.dbPath).toBe('/Users/testuser/.learnforge/learnforge.db');
    expect(result.nodeVersion).toBe(process.version);
  });

  it('skipClaude가 false이면 Claude Desktop 설정을 주입해야 한다', async () => {
    const { injectClaudeDesktopConfig } = await import('./claude-config.js');
    const result = runSetup({ skipClaude: false });
    expect(result.platforms.claude.status).toBe('configured');
    expect(result.platforms.claude.action).toBe('created');
    expect(result.platforms.openclaw.status).toBe('skipped');
    expect(injectClaudeDesktopConfig).toHaveBeenCalledOnce();
  });

  it('커스텀 DB 경로를 전달하면 해당 경로로 초기화해야 한다', async () => {
    const { createDatabase } = await import('../core/index.js');
    const customPath = '/custom/db/path.db';
    const result = runSetup({ dbPath: customPath, skipClaude: true });
    expect(result.dbPath).toBe(customPath);
    expect(createDatabase).toHaveBeenCalledWith(customPath);
  });

  it('target이 openclaw이면 wrapper와 OpenClaw 스킬을 설정해야 한다', async () => {
    const { ensureLearnForgeWrapper, setupOpenClaw } = await import('./openclaw.js');
    const result = runSetup({ skipClaude: false, target: 'openclaw' });

    expect(result.wrapperPath).toBe('/Users/testuser/.learnforge/bin/learnforge');
    expect(result.platforms.claude.status).toBe('skipped');
    expect(result.platforms.openclaw.status).toBe('configured');
    expect(ensureLearnForgeWrapper).toHaveBeenCalledOnce();
    expect(setupOpenClaw).toHaveBeenCalledOnce();
  });

  it('target이 all이면 Claude와 OpenClaw를 모두 설정해야 한다', async () => {
    const { injectClaudeDesktopConfig } = await import('./claude-config.js');
    const { setupOpenClaw } = await import('./openclaw.js');

    const result = runSetup({ skipClaude: false, target: 'all' });

    expect(result.platforms.claude.status).toBe('configured');
    expect(result.platforms.openclaw.status).toBe('configured');
    expect(injectClaudeDesktopConfig).toHaveBeenCalledOnce();
    expect(setupOpenClaw).toHaveBeenCalledOnce();
  });
});
