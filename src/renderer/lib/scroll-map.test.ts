import { describe, expect, it } from 'vitest'
import { lineToOffset, normalizeAnchors, offsetToLine, type LineAnchor } from './scroll-map'

const anchors: LineAnchor[] = [
  { line: 0, top: 0 },
  { line: 10, top: 200 },
  { line: 20, top: 600 },
  { line: 40, top: 1000 }
]

describe('lineToOffset', () => {
  it('hits anchors exactly and interpolates between them', () => {
    expect(lineToOffset(anchors, 10)).toBe(200)
    expect(lineToOffset(anchors, 15)).toBe(400)
    expect(lineToOffset(anchors, 30)).toBe(800)
  })
  it('clamps past the last anchor', () => {
    expect(lineToOffset(anchors, 99)).toBe(1000)
  })
  it('interpolates from the origin when the first block starts below line 0', () => {
    expect(lineToOffset([{ line: 4, top: 100 }], 2)).toBe(50)
  })
  it('returns 0 with no anchors', () => {
    expect(lineToOffset([], 5)).toBe(0)
  })
})

describe('offsetToLine', () => {
  it('is the inverse of lineToOffset', () => {
    for (const line of [0, 3, 10, 17.5, 25, 40]) {
      expect(offsetToLine(anchors, lineToOffset(anchors, line))).toBeCloseTo(line, 6)
    }
  })
})

describe('normalizeAnchors', () => {
  it('sorts, drops duplicate lines, and drops blocks measured above their predecessor', () => {
    const raw: LineAnchor[] = [
      { line: 5, top: 300 },
      { line: 0, top: 0 },
      { line: 5, top: 310 }, // same line, nested element
      { line: 6, top: 290 }, // measured above line 5: out of flow
      { line: 8, top: 400 }
    ]
    expect(normalizeAnchors(raw)).toEqual([
      { line: 0, top: 0 },
      { line: 5, top: 300 },
      { line: 8, top: 400 }
    ])
  })
})
