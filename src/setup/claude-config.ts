import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';

export interface ClaudeConfigResult {
  configPath: string;
  action: 'created' | 'updated';
}

export function getClaudeDesktopConfigPath(): string {
  const platform = process.platform;
  if (platform === 'darwin') {
    return path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'Claude',
      'claude_desktop_config.json',
    );
  }
  if (platform === 'win32') {
    return path.join(
      process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'),
      'Claude',
      'claude_desktop_config.json',
    );
  }
  return path.join(
    os.homedir(),
    '.config',
    'Claude',
    'claude_desktop_config.json',
  );
}

export function getMcpServerPath(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const dir = path.dirname(currentFile);
  const root = path.resolve(dir, '..', '..');
  return path.join(root, 'dist', 'mcp-server.js');
}

export function injectClaudeDesktopConfig(
  configPath: string,
  mcpServerPath: string,
  dbPath: string,
  defaultDbPath: string,
): ClaudeConfigResult {
  let config: Record<string, unknown> = {};
  let action: 'created' | 'updated' = 'created';

  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8') as string);
    action = 'updated';
  }

  const mcpServers =
    (config.mcpServers as Record<string, unknown>) ?? {};

  const entry: Record<string, unknown> = {
    command: 'node',
    args: [mcpServerPath],
  };

  if (dbPath !== defaultDbPath) {
    entry.env = { LEARNFORGE_DB: dbPath };
  }

  mcpServers['learnforge'] = entry;
  config.mcpServers = mcpServers;

  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(
    configPath,
    JSON.stringify(config, null, 2) + '\n',
    'utf-8',
  );

  return { configPath, action };
}
