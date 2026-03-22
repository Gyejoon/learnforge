import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

function resolveMaterialsDir(): string {
  const dir = path.join(os.homedir(), '.learnforge', 'materials');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function saveMaterial(sourceId: string, mdContent: string): string {
  const dir = resolveMaterialsDir();
  const filePath = path.join(dir, `${sourceId}.md`);
  fs.writeFileSync(filePath, mdContent, 'utf-8');
  return filePath;
}

export function getMaterialPath(sourceId: string): string | null {
  const dir = resolveMaterialsDir();
  const filePath = path.join(dir, `${sourceId}.md`);
  return fs.existsSync(filePath) ? filePath : null;
}
