import { initDatabase } from '../storage/database.js';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const dbPath = process.argv[2] || path.join(os.homedir(), '.learnforge', 'learnforge.db');
const dir = path.dirname(dbPath);

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

initDatabase(dbPath);
console.log(`LearnForge database initialized at: ${dbPath}`);
