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
    expect(result.claudeConfig).toBeNull();
    expect(result.dbPath).toBe('/Users/testuser/.learnforge/learnforge.db');
    expect(result.nodeVersion).toBe(process.version);
  });

  it('skipClaude가 false이면 Claude Desktop 설정을 주입해야 한다', async () => {
    const { injectClaudeDesktopConfig } = await import('./claude-config.js');
    const result = runSetup({ skipClaude: false });
    expect(result.claudeConfig).not.toBeNull();
    expect(result.claudeConfig?.action).toBe('created');
    expect(injectClaudeDesktopConfig).toHaveBeenCalledOnce();
  });

  it('커스텀 DB 경로를 전달하면 해당 경로로 초기화해야 한다', async () => {
    const { createDatabase } = await import('../core/index.js');
    const customPath = '/custom/db/path.db';
    const result = runSetup({ dbPath: customPath, skipClaude: true });
    expect(result.dbPath).toBe(customPath);
    expect(createDatabase).toHaveBeenCalledWith(customPath);
  });
});
