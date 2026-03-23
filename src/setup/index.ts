import { createDatabase, resolveDbPath } from '../core/index.js';
import {
  getClaudeDesktopConfigPath,
  getMcpServerPath,
  injectClaudeDesktopConfig,
  type ClaudeConfigResult,
} from './claude-config.js';
import {
  ensureLearnForgeWrapper,
  getLearnForgeCliPath,
  getSkillSourcePath,
  setupOpenClaw,
  type OpenClawSetupResult,
} from './openclaw.js';

export type SetupTarget = 'claude' | 'openclaw' | 'all';

export interface SetupOptions {
  dbPath?: string;
  skipClaude: boolean;
  target?: SetupTarget;
}

export interface SetupPlatformResult {
  status: 'configured' | 'skipped' | 'warning';
  action?: ClaudeConfigResult['action'];
  configPath?: string;
  skillPath?: string;
  message: string;
}

export interface SetupResult {
  nodeVersion: string;
  dbPath: string;
  wrapperPath: string | null;
  platforms: {
    claude: SetupPlatformResult;
    openclaw: SetupPlatformResult;
  };
}

export function checkNodeVersion(): void {
  const [major] = process.versions.node.split('.').map(Number);
  if (major < 20) {
    throw new Error(`Node.js 20+ required (current: ${process.version})`);
  }
}

function resolveTargets(options: SetupOptions): Array<'claude' | 'openclaw'> {
  if (options.target === 'claude') {
    return ['claude'];
  }
  if (options.target === 'openclaw') {
    return ['openclaw'];
  }
  if (options.target === 'all') {
    return ['claude', 'openclaw'];
  }
  if (options.skipClaude) {
    return [];
  }
  return ['claude'];
}

export function runSetup(options: SetupOptions): SetupResult {
  checkNodeVersion();

  const defaultDbPath = resolveDbPath();
  const dbPath = options.dbPath ?? defaultDbPath;

  const db = createDatabase(dbPath);
  db.close();

  const targets = resolveTargets(options);
  const wrapperPath = ensureLearnForgeWrapper(getLearnForgeCliPath());
  const platforms: SetupResult['platforms'] = {
    claude: {
      status: 'skipped',
      message: 'Claude Desktop config: skipped',
    },
    openclaw: {
      status: 'skipped',
      message: 'OpenClaw setup: skipped',
    },
  };

  if (targets.includes('claude')) {
    const configPath = getClaudeDesktopConfigPath();
    const mcpServerPath = getMcpServerPath();
    const claudeConfig = injectClaudeDesktopConfig(
      configPath,
      mcpServerPath,
      dbPath,
      defaultDbPath,
    );
    platforms.claude = {
      status: 'configured',
      action: claudeConfig.action,
      configPath: claudeConfig.configPath,
      message: `Claude Desktop config ${claudeConfig.action}: ${claudeConfig.configPath}`,
    };
  }

  if (targets.includes('openclaw')) {
    const openClawResult: OpenClawSetupResult = setupOpenClaw({
      wrapperPath: wrapperPath!,
      skillSourcePath: getSkillSourcePath(),
    });
    platforms.openclaw = {
      status: openClawResult.status,
      skillPath: openClawResult.skillPath,
      message: openClawResult.message,
    };
  }

  return {
    nodeVersion: process.version,
    dbPath,
    wrapperPath,
    platforms,
  };
}
