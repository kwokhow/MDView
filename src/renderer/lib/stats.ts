export interface DocStats {
  readonly words: number
  readonly chars: number
  readonly lines: number
  /** Estimated reading time at 200 words per minute (0 for an empty document). */
  readonly readingMinutes: number
}

const WORDS_PER_MINUTE = 200
// Words are runs of letters/digits; Markdown punctuation such as "|", "---"
// and "#" is not counted.
const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu

export function computeStats(text: string): DocStats {
  const words = text.match(WORD)?.length ?? 0
  return {
    words,
    chars: text.length,
    lines: text === '' ? 1 : text.split('\n').length,
    readingMinutes: words === 0 ? 0 : Math.max(1, Math.round(words / WORDS_PER_MINUTE))
  }
}
