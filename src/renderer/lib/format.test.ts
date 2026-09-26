import { describe, expect, it } from 'vitest'
import { EditorSelection, EditorState, type TransactionSpec } from '@codemirror/state'
import { insertBlock, insertLink, toggleInline, toggleLineBlock, toggleTaskAtLine } from './format'

/**
 * Build a state from text where "|" marks the cursor and "«" … "»" a selection.
 * (Not [ ]: that is Markdown task-list syntax.)
 */
function stateOf(marked: string): EditorState {
  const hasRange = marked.includes('«') && marked.includes('»')
  if (hasRange) {
    const from = marked.indexOf('«')
    const to = marked.indexOf('»') - 1
    const doc = marked.replace('«', '').replace('»', '')
    return EditorState.create({ doc, selection: EditorSelection.single(from, to), extensions: EditorState.allowMultipleSelections.of(true) })
  }
  const at = marked.indexOf('|')
  return EditorState.create({ doc: marked.replace('|', ''), selection: EditorSelection.cursor(Math.max(0, at)) })
}

function apply(state: EditorState, spec: TransactionSpec | null): EditorState {
  return spec ? state.update(spec).state : state
}

function selected(state: EditorState): string {
  const { from, to } = state.selection.main
  return state.sliceDoc(from, to)
}

describe('toggleInline', () => {
  it('wraps a selection and keeps it selected', () => {
    const s = apply(stateOf('a «word» b'), toggleInline(stateOf('a «word» b'), 'bold'))
    expect(s.doc.toString()).toBe('a **word** b')
    expect(selected(s)).toBe('word')
  })
  it('unwraps when toggled again', () => {
    const once = apply(stateOf('a «word» b'), toggleInline(stateOf('a «word» b'), 'bold'))
    expect(apply(once, toggleInline(once, 'bold')).doc.toString()).toBe('a word b')
  })
  it('unwraps a selection that includes the markers', () => {
    const s = stateOf('a «**word**» b')
    expect(apply(s, toggleInline(s, 'bold')).doc.toString()).toBe('a word b')
  })
  it('does not mistake bold for italic', () => {
    const s = stateOf('a **«word»** b')
    expect(apply(s, toggleInline(s, 'italic')).doc.toString()).toBe('a ***word*** b')
  })
  it('removes italic from bold-italic without touching bold', () => {
    const s = stateOf('a ***«word»*** b')
    expect(apply(s, toggleInline(s, 'italic')).doc.toString()).toBe('a **word** b')
  })
  it('wraps the word under the cursor', () => {
    const s = stateOf('a wo|rd b')
    expect(apply(s, toggleInline(s, 'code')).doc.toString()).toBe('a `word` b')
  })
  it('inserts an empty pair with the cursor inside when not in a word', () => {
    const s = stateOf('a | b')
    const out = apply(s, toggleInline(s, 'strike'))
    expect(out.doc.toString()).toBe('a ~~~~ b')
    expect(out.selection.main.head).toBe(4)
  })
})

describe('toggleLineBlock', () => {
  it('toggles a heading level on and off', () => {
    const on = apply(stateOf('Ti|tle'), toggleLineBlock(stateOf('Ti|tle'), 'heading2'))
    expect(on.doc.toString()).toBe('## Title')
    expect(apply(on, toggleLineBlock(on, 'heading2')).doc.toString()).toBe('Title')
  })
  it('switches heading levels instead of stacking them', () => {
    const s = stateOf('## Ti|tle')
    expect(apply(s, toggleLineBlock(s, 'heading1')).doc.toString()).toBe('# Title')
  })
  it('bullets every selected line, skipping blanks, then removes them', () => {
    const s = stateOf('«one\n\ntwo»')
    const on = apply(s, toggleLineBlock(s, 'bullet'))
    expect(on.doc.toString()).toBe('- one\n\n- two')
    const all = on.update({ selection: EditorSelection.single(0, on.doc.length) }).state
    expect(apply(all, toggleLineBlock(all, 'bullet')).doc.toString()).toBe('one\n\ntwo')
  })
  it('numbers ordered lists and converts from bullets', () => {
    const s = stateOf('«- a\n- b\n- c»')
    expect(apply(s, toggleLineBlock(s, 'ordered')).doc.toString()).toBe('1. a\n2. b\n3. c')
  })
  it('keeps indentation for nested list items', () => {
    const s = stateOf('  it|em')
    expect(apply(s, toggleLineBlock(s, 'task')).doc.toString()).toBe('  - [ ] item')
  })
  it('quotes and unquotes', () => {
    const on = apply(stateOf('«a\nb»'), toggleLineBlock(stateOf('«a\nb»'), 'quote'))
    expect(on.doc.toString()).toBe('> a\n> b')
    const all = on.update({ selection: EditorSelection.single(0, on.doc.length) }).state
    expect(apply(all, toggleLineBlock(all, 'quote')).doc.toString()).toBe('a\nb')
  })
})

describe('insertLink', () => {
  it('wraps selected text and selects the url placeholder', () => {
    const out = apply(stateOf('see «docs» now'), insertLink(stateOf('see «docs» now')))
    expect(out.doc.toString()).toBe('see [docs](url) now')
    expect(selected(out)).toBe('url')
  })
  it('turns a selected URL into a link and puts the cursor in the label', () => {
    const out = apply(stateOf('«https://x.org»'), insertLink(stateOf('«https://x.org»')))
    expect(out.doc.toString()).toBe('[](https://x.org)')
    expect(out.selection.main.head).toBe(1)
  })
})

describe('insertBlock', () => {
  it('puts a table on its own lines and selects the first header', () => {
    const s = stateOf('text|')
    const out = apply(s, insertBlock(s, 'table'))
    expect(out.doc.toString()).toBe('text\n\n| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n|  |  |  |\n')
    expect(selected(out)).toBe('Column 1')
  })
  it('fences the selected lines as a code block', () => {
    const s = stateOf('«SELECT 1;\nSELECT 2;»')
    expect(apply(s, insertBlock(s, 'codeBlock')).doc.toString()).toBe('```\nSELECT 1;\nSELECT 2;\n```')
  })
})

describe('toggleTaskAtLine', () => {
  it('flips a checkbox on the given source line', () => {
    const s = stateOf('- [ ] a\n- [x] b|')
    expect(apply(s, toggleTaskAtLine(s, 0)).doc.toString()).toBe('- [x] a\n- [x] b')
    expect(apply(s, toggleTaskAtLine(s, 1)).doc.toString()).toBe('- [ ] a\n- [ ] b')
  })
  it('handles numbered and indented task items', () => {
    const s = stateOf('  1. [ ] step|')
    expect(apply(s, toggleTaskAtLine(s, 0)).doc.toString()).toBe('  1. [x] step')
  })
  it('returns null for lines that are not tasks, or out of range', () => {
    const s = stateOf('plain|')
    expect(toggleTaskAtLine(s, 0)).toBeNull()
    expect(toggleTaskAtLine(s, 5)).toBeNull()
  })
})
