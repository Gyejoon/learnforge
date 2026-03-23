import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';

export interface OpenClawSetupOptions {
  wrapperPath: string;
  skillSourcePath: string;
}

export interface OpenClawSetupResult {
  status: 'configured' | 'warning';
  skillPath?: string;
  message: string;
}

export function getLearnForgeWrapperPath(): string {
  return path.join(os.homedir(), '.learnforge', 'bin', 'learnforge');
}

export function getOpenClawSkillPath(): string {
  return path.join(os.homedir(), '.openclaw', 'skills', 'learnforge', 'SKILL.md');
}

export function getLearnForgeCliPath(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const dir = path.dirname(currentFile);
  const root = path.resolve(dir, '..', '..');
  return path.join(root, 'dist', 'cli.js');
}

export function getSkillSourcePath(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const dir = path.dirname(currentFile);
  const root = path.resolve(dir, '..', '..');
  return path.join(root, 'skills', 'learnforge', 'SKILL.md');
}

function escapeForDoubleQuotes(value: string): string {
  return value.replace(/(["\\$`])/g, '\\$1');
}

export function ensureLearnForgeWrapper(cliPath: string): string {
  const wrapperPath = getLearnForgeWrapperPath();
  fs.mkdirSync(path.dirname(wrapperPath), { recursive: true });

  const escapedCliPath = escapeForDoubleQuotes(cliPath);
  const script = `#!/usr/bin/env sh
exec node "${escapedCliPath}" "$@"
`;

  fs.writeFileSync(wrapperPath, script, 'utf-8');
  fs.chmodSync(wrapperPath, 0o755);
  return wrapperPath;
}

function hasOpenClawCli(): boolean {
  try {
    childProcess.execFileSync('openclaw', ['--version'], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

export function setupOpenClaw(
  options: OpenClawSetupOptions,
): OpenClawSetupResult {
  const skillPath = getOpenClawSkillPath();

  if (!hasOpenClawCli()) {
    return {
      status: 'warning',
      skillPath,
      message: 'OpenClaw CLI not found. Install OpenClaw and re-run `learnforge setup --target openclaw`.',
    };
  }

  const template = fs.readFileSync(options.skillSourcePath, 'utf-8') as string;
  const rendered = template.replaceAll('{{LEARNFORGE_BIN}}', options.wrapperPath);

  fs.mkdirSync(path.dirname(skillPath), { recursive: true });
  fs.writeFileSync(skillPath, rendered, 'utf-8');

  childProcess.execFileSync('openclaw', ['skills', 'list'], {
    stdio: 'ignore',
  });

  return {
    status: 'configured',
    skillPath,
    message: 'OpenClaw skill installed.',
  };
}
