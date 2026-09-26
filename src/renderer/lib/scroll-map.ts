/**
 * Maps between a source line in the editor and a pixel offset in the preview.
 *
 * Each rendered block carries the source line it came from; its measured top
 * becomes an anchor. Positions between anchors are interpolated linearly, so
 * a long paragraph scrolls smoothly rather than jumping block to block.
 */
export interface LineAnchor {
  /** 0-based (fractional allowed) source line. */
  readonly line: number
  /** Pixel offset from the top of the scrollable preview content. */
  readonly top: number
}

type Axis = 'line' | 'top'

/**
 * Sort anchors by line and drop any that would make the mapping non-monotonic
 * (same line twice, or a nested block measured above its predecessor).
 */
export function normalizeAnchors(raw: readonly LineAnchor[]): LineAnchor[] {
  const sorted = [...raw].sort((a, b) => a.line - b.line || a.top - b.top)
  const out: LineAnchor[] = []
  for (const anchor of sorted) {
    const prev = out[out.length - 1]
    if (prev && (anchor.line === prev.line || anchor.top < prev.top)) continue
    out.push(anchor)
  }
  return out
}

/** Index of the last anchor whose `axis` value is <= value (binary search). */
function lastAtOrBefore(anchors: readonly LineAnchor[], value: number, axis: Axis): number {
  let lo = 0
  let hi = anchors.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (anchors[mid][axis] <= value) {
      found = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return found
}

function interpolate(anchors: readonly LineAnchor[], value: number, from: Axis, to: Axis): number {
  if (anchors.length === 0) return 0
  const first = anchors[0]
  if (value <= first[from]) {
    // Before the first block: interpolate from the origin (line 0, top 0).
    return first[from] > 0 ? (Math.max(0, value) / first[from]) * first[to] : first[to]
  }
  const i = lastAtOrBefore(anchors, value, from)
  const a = anchors[i]
  const b = anchors[i + 1]
  if (!b) return a[to]
  const span = b[from] - a[from]
  return span > 0 ? a[to] + ((value - a[from]) / span) * (b[to] - a[to]) : a[to]
}

/** Source line → preview pixel offset. */
export function lineToOffset(anchors: readonly LineAnchor[], line: number): number {
  return interpolate(anchors, line, 'line', 'top')
}

/** Preview pixel offset → source line. */
export function offsetToLine(anchors: readonly LineAnchor[], top: number): number {
  return interpolate(anchors, top, 'top', 'line')
}
