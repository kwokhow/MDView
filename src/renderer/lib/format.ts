import { EditorSelection, type EditorState, type Line, type TransactionSpec } from '@codemirror/state'

/**
 * Markdown formatting commands as pure functions of editor state. Each returns
 * a transaction for the caller to dispatch, so they are testable without a view.
 */

export type InlineMark = 'bold' | 'italic' | 'strike' | 'code'
export type LineBlock = 'heading1' | 'heading2' | 'heading3' | 'quote' | 'bullet' | 'ordered' | 'task'
export type InsertBlock = 'codeBlock' | 'table' | 'hr'

const MARKERS: Record<InlineMark, string> = { bold: '**', italic: '*', strike: '~~', code: '`' }

const HEADING = /^#{1,6}[ \t]+/
const QUOTE = /^>[ \t]?/
const TASK = /^[-*+][ \t]+\[[ xX]\][ \t]+/
const BULLET = /^[-*+][ \t]+/
const ORDERED = /^\d+[.)][ \t]+/

/** Length of the run of `ch` ending at `pos` (dir -1) or starting at `pos` (dir 1). */
function runLength(state: EditorState, pos: number, dir: 1 | -1, ch: string): number {
  let n = 0
  let p = dir === -1 ? pos - 1 : pos
  while (p >= 0 && p < state.doc.length && state.sliceDoc(p, p + 1) === ch) {
    n++
    p += dir
  }
  return n
}

/** Is the text between from/to already wrapped by `mark` just outside it? */
function wrappedOutside(state: EditorState, from: number, to: number, mark: InlineMark): boolean {
  const m = MARKERS[mark]
  if (mark === 'italic' || mark === 'bold') {
    const before = runLength(state, from, -1, '*')
    const after = runLength(state, to, 1, '*')
    // "*x*" and "***x***" are italic; "**x**" and "***x***" are bold.
    return mark === 'italic' ? before % 2 === 1 && after % 2 === 1 : before >= 2 && after >= 2
  }
  return from >= m.length && state.sliceDoc(from - m.length, from) === m && state.sliceDoc(to, to + m.length) === m
}

/**
 * Wrap each selection in a marker, or unwrap it if it is already wrapped. With
 * no selection the word under the cursor is used; outside a word an empty pair
 * is inserted with the cursor between.
 */
export function toggleInline(state: EditorState, mark: InlineMark): TransactionSpec {
  const m = MARKERS[mark]
  return state.changeByRange((range) => {
    let { from, to } = range
    if (from === to) {
      const word = state.wordAt(from)
      if (word) ({ from, to } = word)
    }
    const text = state.sliceDoc(from, to)

    if (to > from && wrappedOutside(state, from, to, mark)) {
      return {
        changes: [
          { from: from - m.length, to: from },
          { from: to, to: to + m.length }
        ],
        range: EditorSelection.range(from - m.length, to - m.length)
      }
    }
    if (text.length >= 2 * m.length && text.startsWith(m) && text.endsWith(m)) {
      const inner = text.slice(m.length, text.length - m.length)
      return { changes: { from, to, insert: inner }, range: EditorSelection.range(from, from + inner.length) }
    }
    return {
      changes: [
        { from, insert: m },
        { from: to, insert: m }
      ],
      range: EditorSelection.range(from + m.length, to + m.length)
    }
  })
}

/** Lines touched by the selection; a range ending at a line start excludes that line. */
function selectedLines(state: EditorState): Line[] {
  const seen = new Set<number>()
  const lines: Line[] = []
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number
    let last = state.doc.lineAt(range.to).number
    if (last > first && state.doc.line(last).from === range.to) last--
    for (let n = first; n <= last; n++) {
      if (seen.has(n)) continue
      seen.add(n)
      lines.push(state.doc.line(n))
    }
  }
  return lines.sort((a, b) => a.number - b.number)
}

interface LineParts {
  readonly line: Line
  readonly indent: string
  readonly rest: string
}

function splitLine(line: Line): LineParts {
  const indent = /^[ \t]*/.exec(line.text)?.[0] ?? ''
  return { line, indent, rest: line.text.slice(indent.length) }
}

function markerLength(rest: string, pattern: RegExp): number {
  return pattern.exec(rest)?.[0].length ?? 0
}

function listMarkerLength(rest: string): number {
  return markerLength(rest, TASK) || markerLength(rest, BULLET) || markerLength(rest, ORDERED)
}

/** Decide, for one line, how many prefix chars to replace and with what. */
function lineEdit(parts: LineParts, block: LineBlock, removing: boolean, index: number): { cut: number; insert: string } {
  const { indent, rest } = parts
  if (block.startsWith('heading')) {
    const level = Number(block.slice(-1))
    const cut = indent.length + markerLength(rest, HEADING)
    return { cut, insert: removing ? '' : `${'#'.repeat(level)} ` }
  }
  if (block === 'quote') {
    return removing
      ? { cut: indent.length + markerLength(rest, QUOTE), insert: indent }
      : { cut: indent.length, insert: `${indent}> ` }
  }
  const cut = indent.length + listMarkerLength(rest)
  if (removing) return { cut, insert: indent }
  const marker = block === 'task' ? '- [ ] ' : block === 'ordered' ? `${index + 1}. ` : '- '
  return { cut, insert: `${indent}${marker}` }
}

function hasBlock(parts: LineParts, block: LineBlock): boolean {
  const { rest } = parts
  if (block.startsWith('heading')) {
    const level = Number(block.slice(-1))
    return HEADING.test(rest) && (/^#+/.exec(rest)?.[0].length ?? 0) === level
  }
  if (block === 'quote') return QUOTE.test(rest)
  if (block === 'task') return TASK.test(rest)
  if (block === 'bullet') return BULLET.test(rest) && !TASK.test(rest)
  return ORDERED.test(rest)
}

/**
 * Toggle a line-level block (heading, quote, list) on every selected line. If
 * every line already has it, it is removed; otherwise it is applied, replacing
 * any other list marker. Blank lines are skipped when several are selected.
 */
export function toggleLineBlock(state: EditorState, block: LineBlock): TransactionSpec {
  const all = selectedLines(state).map(splitLine)
  const targets = all.length > 1 ? all.filter((p) => p.rest.trim() !== '') : all
  if (targets.length === 0) return {}
  const removing = targets.every((p) => hasBlock(p, block))
  const changes = targets.map((parts, i) => {
    const { cut, insert } = lineEdit(parts, block, removing, i)
    return { from: parts.line.from, to: parts.line.from + cut, insert }
  })
  return { changes, scrollIntoView: true }
}

/** Insert a Markdown link around the selection (or a placeholder) and select the part to type. */
export function insertLink(state: EditorState): TransactionSpec {
  return state.changeByRange((range) => {
    const text = state.sliceDoc(range.from, range.to)
    if (/^(https?:\/\/|www\.)\S+$/.test(text)) {
      return { changes: { from: range.from, to: range.to, insert: `[](${text})` }, range: EditorSelection.cursor(range.from + 1) }
    }
    const label = text || 'text'
    const insert = `[${label}](url)`
    const anchor = text ? range.from + label.length + 3 : range.from + 1
    const head = text ? anchor + 3 : anchor + label.length
    return { changes: { from: range.from, to: range.to, insert }, range: EditorSelection.range(anchor, head) }
  })
}

const TABLE = '| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n|  |  |  |'

/** Insert a code block, table or horizontal rule at the cursor, on its own lines. */
export function insertBlock(state: EditorState, block: InsertBlock): TransactionSpec {
  const range = state.selection.main
  if (block === 'codeBlock' && !range.empty) {
    const from = state.doc.lineAt(range.from).from
    const to = state.doc.lineAt(range.to).to
    const insert = `\`\`\`\n${state.sliceDoc(from, to)}\n\`\`\``
    return { changes: { from, to, insert }, selection: EditorSelection.cursor(from + 3), scrollIntoView: true }
  }

  const line = state.doc.lineAt(range.from)
  const atLineStart = range.from === line.from
  const prevBlank = line.number === 1 || state.doc.line(line.number - 1).text.trim() === ''
  const lead = !atLineStart ? '\n\n' : prevBlank ? '' : '\n'
  const body = block === 'table' ? TABLE : block === 'hr' ? '---' : '```\n\n```'
  const insert = `${lead}${body}\n`
  const start = range.from + lead.length
  const selection =
    block === 'table'
      ? EditorSelection.range(start + 2, start + 10)
      : block === 'codeBlock'
        ? EditorSelection.cursor(start + 3)
        : EditorSelection.cursor(start + insert.length - lead.length)
  return { changes: { from: range.from, to: range.to, insert }, selection, scrollIntoView: true }
}

/** Flip the checkbox of a task-list item on the given 0-based source line. */
export function toggleTaskAtLine(state: EditorState, line: number): TransactionSpec | null {
  if (line < 0 || line >= state.doc.lines) return null
  const docLine = state.doc.line(line + 1)
  const match = /^([ \t]*(?:[-*+]|\d+[.)])[ \t]+\[)([ xX])\]/.exec(docLine.text)
  if (!match) return null
  const pos = docLine.from + match[1].length
  return { changes: { from: pos, to: pos + 1, insert: match[2] === ' ' ? 'x' : ' ' } }
}
