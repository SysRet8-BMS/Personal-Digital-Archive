const MAX_CHARS = 3_500;
const OVERLAP_CHARS = 300;

export function splitIntoChunks(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/[\t ]+/g, " ").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + MAX_CHARS, normalized.length);
    if (end < normalized.length) {
      const boundary = normalized.lastIndexOf("\n", end);
      const sentence = normalized.lastIndexOf(". ", end);
      const split = Math.max(boundary, sentence);
      if (split > start + MAX_CHARS * 0.6) end = split + (split === sentence ? 1 : 0);
    }
    const content = normalized.slice(start, end).trim();
    if (content) chunks.push(content);
    if (end >= normalized.length) break;
    start = Math.max(start + 1, end - OVERLAP_CHARS);
  }
  return chunks;
}
