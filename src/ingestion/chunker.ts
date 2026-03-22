const DEFAULT_MAX_TOKENS = 1500;
const DEFAULT_OVERLAP = 200;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into semantic chunks respecting maxTokens per chunk.
 * Splitting strategy: paragraph boundaries first, then sentence boundaries.
 * Overlap: the last `overlap` tokens from the previous chunk are prepended to the next.
 */
export function chunkText(
  text: string,
  maxTokens: number = DEFAULT_MAX_TOKENS,
  overlap: number = DEFAULT_OVERLAP,
): string[] {
  if (estimateTokens(text) <= maxTokens) {
    return [text];
  }

  // Split at paragraph boundaries first
  const paragraphs = text.split(/\n\n+/);

  // Group paragraphs into chunks respecting maxTokens
  const rawChunks = groupIntoChunks(paragraphs, maxTokens);

  // Apply overlap between consecutive chunks
  return applyOverlap(rawChunks, overlap);
}

function groupIntoChunks(segments: string[], maxTokens: number): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const segment of segments) {
    const segTokens = estimateTokens(segment);

    if (segTokens > maxTokens) {
      // Segment itself is too long — split at sentence boundaries
      if (current.length > 0) {
        chunks.push(current.join('\n\n'));
        current = [];
        currentTokens = 0;
      }
      const sentenceChunks = splitBySentences(segment, maxTokens);
      chunks.push(...sentenceChunks);
      continue;
    }

    if (currentTokens + segTokens > maxTokens && current.length > 0) {
      chunks.push(current.join('\n\n'));
      current = [];
      currentTokens = 0;
    }

    current.push(segment);
    currentTokens += segTokens;
  }

  if (current.length > 0) {
    chunks.push(current.join('\n\n'));
  }

  return chunks;
}

function splitBySentences(text: string, maxTokens: number): string[] {
  // Split at sentence boundaries: `. `, `! `, `? `
  const sentences = text.split(/(?<=[.!?])\s+/);

  // If sentences still contain segments that are too large, hard-split by characters
  const maxChars = maxTokens * 4;
  const normalized: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= maxChars) {
      normalized.push(sentence);
    } else {
      // Hard split — no further recursion
      for (let i = 0; i < sentence.length; i += maxChars) {
        normalized.push(sentence.slice(i, i + maxChars));
      }
    }
  }

  return groupIntoChunks(normalized, maxTokens);
}

function applyOverlap(chunks: string[], overlap: number): string[] {
  if (chunks.length <= 1 || overlap <= 0) return chunks;

  const result: string[] = [chunks[0]];

  for (let i = 1; i < chunks.length; i++) {
    const prev = chunks[i - 1];
    // Take the last `overlap` tokens (overlap * 4 chars) from the previous chunk
    const overlapChars = overlap * 4;
    const tail = prev.length > overlapChars ? prev.slice(-overlapChars) : prev;
    result.push(tail + '\n\n' + chunks[i]);
  }

  return result;
}
