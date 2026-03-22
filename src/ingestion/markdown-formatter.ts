import type { SourceType } from '../types.js';

export interface MarkdownMetadata {
  title: string;
  source: string;
  type: SourceType;
  ingested: string;
}

export function formatAsMarkdown(content: string, metadata: MarkdownMetadata): string {
  const frontmatter = [
    '---',
    `title: "${metadata.title.replace(/"/g, '\\"')}"`,
    `source: "${metadata.source.replace(/"/g, '\\"')}"`,
    `type: "${metadata.type}"`,
    `ingested: "${metadata.ingested}"`,
    '---',
  ].join('\n');

  return `${frontmatter}\n\n# ${metadata.title}\n\n${content.trim()}\n`;
}
