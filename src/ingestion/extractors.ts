import { readFile } from 'fs/promises';
import { extname } from 'path';
import type { SourceType } from '../types.js';

const CODE_EXTENSIONS = new Set([
  '.ts', '.js', '.py', '.java', '.go', '.rs', '.cpp', '.c', '.rb', '.kt', '.swift',
]);

export function detectSourceType(input: string): SourceType {
  // YouTube check before generic URL
  if (input.includes('youtube.com') || input.includes('youtu.be')) {
    return 'youtube';
  }

  // Generic HTTP/HTTPS URL
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return 'url';
  }

  const ext = extname(input).toLowerCase();

  if (ext === '.pdf') return 'pdf';
  if (ext === '.md') return 'markdown';
  if (CODE_EXTENSIONS.has(ext)) return 'code';

  return 'text';
}

export async function extractText(input: string): Promise<string> {
  // If the string contains spaces or newlines it is almost certainly inline text, not a file path
  if (input.includes(' ') || input.includes('\n')) {
    return input;
  }
  // If it looks like a file path, read it
  const ext = extname(input);
  if (ext || input.startsWith('/') || input.startsWith('./') || input.startsWith('../')) {
    return readFile(input, 'utf-8');
  }
  // No extension, no path markers, no spaces → treat as inline text
  return input;
}

export async function extractMarkdown(filePath: string): Promise<string> {
  return readFile(filePath, 'utf-8');
}

export async function extractCode(filePath: string): Promise<string> {
  const ext = extname(filePath).toLowerCase().slice(1);
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    js: 'javascript',
    py: 'python',
    java: 'java',
    go: 'go',
    rs: 'rust',
    cpp: 'cpp',
    c: 'c',
    rb: 'ruby',
    kt: 'kotlin',
    swift: 'swift',
  };
  const language = languageMap[ext] ?? ext;
  const content = await readFile(filePath, 'utf-8');
  return `\`\`\`${language}\n${content}\n\`\`\``;
}

export async function extractPdf(filePath: string): Promise<string> {
  try {
    const { default: pdfParse } = await import('pdf-parse');
    const buffer = await readFile(filePath);
    const result = await pdfParse(buffer);
    return result.text;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to extract PDF from ${filePath}: ${message}`);
  }
}

export async function extractYoutube(url: string): Promise<string> {
  try {
    const { YoutubeTranscript } = await import('youtube-transcript');
    const segments = await YoutubeTranscript.fetchTranscript(url);
    return segments.map(segment => segment.text).join(' ');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch YouTube transcript from ${url}: ${message}`);
  }
}

export async function extractUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch URL ${url}: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  // Strip HTML tags and normalise whitespace
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
