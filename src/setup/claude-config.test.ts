import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  getClaudeDesktopConfigPath,
  injectClaudeDesktopConfig,
} from './claude-config.js';

vi.mock('fs');
vi.mock('os');

const mockedFs = vi.mocked(fs);
const mockedOs = vi.mocked(os);

beforeEach(() => {
  vi.resetAllMocks();
  mockedOs.homedir.mockReturnValue('/Users/testuser');
});

describe('getClaudeDesktopConfigPath', () => {
  it('macOS에서 올바른 경로를 반환해야 한다', () => {
    vi.stubGlobal('process', { ...process, platform: 'darwin' });
    const result = getClaudeDesktopConfigPath();
    expect(result).toBe(
      '/Users/testuser/Library/Application Support/Claude/claude_desktop_config.json',
    );
    vi.unstubAllGlobals();
  });

  it('win32에서 올바른 경로를 반환해야 한다', () => {
    vi.stubGlobal('process', {
      ...process,
      platform: 'win32',
      env: { APPDATA: 'C:\\Users\\test\\AppData\\Roaming' },
    });
    const result = getClaudeDesktopConfigPath();
    expect(result).toBe(
      path.join(
        'C:\\Users\\test\\AppData\\Roaming',
        'Claude',
        'claude_desktop_config.json',
      ),
    );
    vi.unstubAllGlobals();
  });

  it('linux에서 올바른 경로를 반환해야 한다', () => {
    vi.stubGlobal('process', { ...process, platform: 'linux' });
    const result = getClaudeDesktopConfigPath();
    expect(result).toBe(
      '/Users/testuser/.config/Claude/claude_desktop_config.json',
    );
    vi.unstubAllGlobals();
  });
});

describe('injectClaudeDesktopConfig', () => {
  const configPath = '/tmp/test-claude-config.json';
  const mcpServerPath = '/path/to/dist/mcp-server.js';
  const defaultDbPath = '/Users/testuser/.learnforge/learnforge.db';

  it('config 파일이 없으면 새로 생성해야 한다', () => {
    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.writeFileSync.mockImplementation(() => {});
    mockedFs.mkdirSync.mockImplementation(() => '' as never);

    const result = injectClaudeDesktopConfig(
      configPath,
      mcpServerPath,
      defaultDbPath,
      defaultDbPath,
    );

    expect(result.action).toBe('created');
    expect(mockedFs.writeFileSync).toHaveBeenCalledOnce();
    const written = JSON.parse(
      (mockedFs.writeFileSync.mock.calls[0][1] as string).trim(),
    );
    expect(written.mcpServers.learnforge.command).toBe('node');
    expect(written.mcpServers.learnforge.args).toEqual([mcpServerPath]);
  });

  it('기존 mcpServers가 있으면 보존하고 learnforge만 추가해야 한다', () => {
    const existing = {
      mcpServers: { 'other-server': { command: 'other' } },
    };
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(existing));
    mockedFs.writeFileSync.mockImplementation(() => {});

    injectClaudeDesktopConfig(
      configPath,
      mcpServerPath,
      defaultDbPath,
      defaultDbPath,
    );

    const written = JSON.parse(
      (mockedFs.writeFileSync.mock.calls[0][1] as string).trim(),
    );
    expect(written.mcpServers['other-server'].command).toBe('other');
    expect(written.mcpServers['learnforge']).toBeDefined();
  });

  it('기존 learnforge 항목이 있으면 업데이트해야 한다', () => {
    const existing = {
      mcpServers: { learnforge: { command: 'node', args: ['/old/path'] } },
    };
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(existing));
    mockedFs.writeFileSync.mockImplementation(() => {});

    const result = injectClaudeDesktopConfig(
      configPath,
      mcpServerPath,
      defaultDbPath,
      defaultDbPath,
    );

    expect(result.action).toBe('updated');
    const written = JSON.parse(
      (mockedFs.writeFileSync.mock.calls[0][1] as string).trim(),
    );
    expect(written.mcpServers.learnforge.args).toEqual([mcpServerPath]);
  });

  it('커스텀 DB 경로가 기본값이 아니면 env에 포함해야 한다', () => {
    const customDbPath = '/custom/path/learnforge.db';
    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.writeFileSync.mockImplementation(() => {});
    mockedFs.mkdirSync.mockImplementation(() => '' as never);

    injectClaudeDesktopConfig(
      configPath,
      mcpServerPath,
      customDbPath,
      defaultDbPath,
    );

    const written = JSON.parse(
      (mockedFs.writeFileSync.mock.calls[0][1] as string).trim(),
    );
    expect(written.mcpServers.learnforge.env).toEqual({
      LEARNFORGE_DB: customDbPath,
    });
  });

  it('기본 DB 경로이면 env를 포함하지 않아야 한다', () => {
    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.writeFileSync.mockImplementation(() => {});
    mockedFs.mkdirSync.mockImplementation(() => '' as never);

    injectClaudeDesktopConfig(
      configPath,
      mcpServerPath,
      defaultDbPath,
      defaultDbPath,
    );

    const written = JSON.parse(
      (mockedFs.writeFileSync.mock.calls[0][1] as string).trim(),
    );
    expect(written.mcpServers.learnforge.env).toBeUndefined();
  });
});
