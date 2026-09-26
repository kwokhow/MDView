import { describe, expect, it } from 'vitest'
import { computeStats } from './stats'

describe('computeStats', () => {
  it('counts words but not Markdown punctuation', () => {
    // Title, a, b, it’s, done_now — the #, pipes and dashes are not words.
    const s = computeStats('# Title\n\n| a | b |\n| --- | --- |\n\n- it’s done_now\n')
    expect(s.words).toBe(5)
    expect(s.lines).toBe(7)
  })
  it('estimates reading time at 200 wpm, minimum one minute', () => {
    expect(computeStats('word '.repeat(4409)).readingMinutes).toBe(22)
    expect(computeStats('just a few words').readingMinutes).toBe(1)
    expect(computeStats('').readingMinutes).toBe(0)
  })
})
