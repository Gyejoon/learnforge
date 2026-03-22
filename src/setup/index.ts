import { createDatabase, resolveDbPath } from '../core/index.js';
import {
  getClaudeDesktopConfigPath,
  getMcpServerPath,
  injectClaudeDesktopConfig,
  type ClaudeConfigResult,
} from './claude-config.js';

export interface SetupOptions {
  dbPath?: string;
  skipClaude: boolean;
}

export interface SetupResult {
  nodeVersion: string;
  dbPath: string;
  claudeConfig: ClaudeConfigResult | null;
}

export function checkNodeVersion(): void {
  const [major] = process.versions.node.split('.').map(Number);
  if (major < 20) {
    throw new Error(`Node.js 20+ required (current: ${process.version})`);
  }
}

export function runSetup(options: SetupOptions): SetupResult {
  checkNodeVersion();

  const defaultDbPath = resolveDbPath();
  const dbPath = options.dbPath ?? defaultDbPath;

  const db = createDatabase(dbPath);
  db.close();

  let claudeConfig: ClaudeConfigResult | null = null;

  if (!options.skipClaude) {
    const configPath = getClaudeDesktopConfigPath();
    const mcpServerPath = getMcpServerPath();
    claudeConfig = injectClaudeDesktopConfig(
      configPath,
      mcpServerPath,
      dbPath,
      defaultDbPath,
    );
  }

  return {
    nodeVersion: process.version,
    dbPath,
    claudeConfig,
  };
}
