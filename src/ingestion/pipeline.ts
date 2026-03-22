import { createHash } from 'crypto';
import type Database from 'better-sqlite3';
import type { Source, Chunk } from '../types.js';
import {
  detectSourceType,
  extractText,
  extractMarkdown,
  extractCode,
  extractPdf,
  extractYoutube,
  extractUrl,
} from './extractors.js';
import { chunkText } from './chunker.js';
import {
  insertSource,
  insertChunk,
  getSourceByHash,
} from '../storage/index.js';
import { formatAsMarkdown } from './markdown-formatter.js';
import { saveMaterial } from './materials.js';

export interface IngestResult {
  source: Source;
  chunks: Chunk[];
  totalTokens: number;
  materialPath: string | null;
}

async function extractContent(input: string): Promise<string> {
  const sourceType = detectSourceType(input);

  switch (sourceType) {
    case 'pdf':
      return extractPdf(input);
    case 'markdown':
      return extractMarkdown(input);
    case 'code':
      return extractCode(input);
    case 'youtube':
      return extractYoutube(input);
    case 'url':
      return extractUrl(input);
    case 'text':
    default:
      return extractText(input);
  }
}

export async function ingest(
  input: string,
  db: Database.Database,
  options?: { title?: string; deck?: string },
): Promise<IngestResult> {
  const sourceType = detectSourceType(input);

  // Extract text content
  const content = await extractContent(input);

  // Compute SHA-256 hash for deduplication
  const contentHash = createHash('sha256').update(content).digest('hex');

  // Check for existing source with same hash
  const existing = getSourceByHash(db, contentHash);
  if (existing !== null) {
    const totalTokens = Math.ceil(content.length / 4);
    return { source: existing, chunks: [], totalTokens, materialPath: null };
  }

  // Build source record
  const now = new Date().toISOString();
  const title = options?.title ?? deriveTitle(input, sourceType);
  const metadata: Record<string, unknown> = {};
  if (options?.deck !== undefined) {
    metadata['deck'] = options.deck;
  }

  const source: Source = {
    id: crypto.randomUUID(),
    title,
    type: sourceType,
    originalPath: input,
    contentHash,
    metadata,
    createdAt: now,
  };

  insertSource(db, source);

  // Chunk the content
  const textChunks = chunkText(content);
  const chunks: Chunk[] = textChunks.map((chunkContent, index) => ({
    id: crypto.randomUUID(),
    sourceId: source.id,
    chunkIndex: index,
    content: chunkContent,
    tokenCount: Math.ceil(chunkContent.length / 4),
    summary: null,
    keyConcepts: null,
  }));

  for (const chunk of chunks) {
    insertChunk(db, chunk);
  }

  const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);

  // Save markdown version of the material
  let materialPath: string | null = null;
  try {
    const mdContent = formatAsMarkdown(content, {
      title,
      source: input,
      type: sourceType,
      ingested: now,
    });
    materialPath = saveMaterial(source.id, mdContent);
  } catch {
    // Non-critical: if MD save fails, ingestion still succeeds
  }

  return { source, chunks, totalTokens, materialPath };
}

function deriveTitle(input: string, sourceType: string): string {
  if (sourceType === 'url' || sourceType === 'youtube') {
    return input;
  }
  // Use filename or first 60 chars of text
  const parts = input.split(/[/\\]/);
  const last = parts[parts.length - 1];
  if (last && last.length > 0 && last.length <= 200) {
    return last;
  }
  return input.slice(0, 60) || 'Untitled';
}
