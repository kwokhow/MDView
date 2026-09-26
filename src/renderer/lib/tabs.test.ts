import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import {
  addTab,
  duplicateHints,
  EMPTY_TABS,
  findByPath,
  hasDirty,
  isDirty,
  isDisposable,
  neighborId,
  nextUntitledIndex,
  removeTab,
  resolvePathClash,
  sessionOf,
  tabName,
  updateTab,
  type Tab
} from './tabs'

function makeTab(id: string, path: string | null, text = 'x', untitledIndex = 1): Tab {
  const state = EditorState.create({ doc: text })
  return { id, path, untitledIndex, state, savedDoc: state.doc, editorScroll: 0, previewScroll: 0 }
}

function edited(tab: Tab, text: string): Tab {
  return { ...tab, state: tab.state.update({ changes: { from: 0, to: tab.state.doc.length, insert: text } }).state }
}

describe('tab names and dirtiness', () => {
  it('names tabs from the file, or Untitled-N', () => {
    expect(tabName(makeTab('a', 'C:\\d\\notes.md'))).toBe('notes.md')
    expect(tabName(makeTab('b', null))).toBe('Untitled')
    expect(tabName(makeTab('c', null, '', 3))).toBe('Untitled-3')
  })
  it('is dirty only while the text differs from the saved text', () => {
    const tab = makeTab('a', 'C:\\a.md', 'hello')
    expect(isDirty(tab)).toBe(false)
    expect(isDirty(edited(tab, 'hello!'))).toBe(true)
    expect(isDirty(edited(edited(tab, 'hello!'), 'hello'))).toBe(false)
  })
  it('only treats unchanged untitled tabs as disposable', () => {
    expect(isDisposable(makeTab('a', null))).toBe(true)
    expect(isDisposable(edited(makeTab('a', null), 'typed'))).toBe(false)
    expect(isDisposable(makeTab('b', 'C:\\a.md'))).toBe(false)
  })
})

describe('tab list operations', () => {
  const list = [makeTab('a', 'C:\\a.md'), makeTab('b', 'C:\\b.md'), makeTab('c', 'C:\\c.md')].reduce(addTab, EMPTY_TABS)

  it('activates tabs as they are added, without mutating the old list', () => {
    expect(list.activeId).toBe('c')
    expect(EMPTY_TABS.tabs).toHaveLength(0)
  })
  it('activates the right neighbour when closing the active tab, else the left', () => {
    const mid = { ...list, activeId: 'b' }
    expect(removeTab(mid, 'b').activeId).toBe('c')
    expect(removeTab(list, 'c').activeId).toBe('b')
    expect(removeTab(removeTab(removeTab(list, 'a'), 'b'), 'c')).toEqual(EMPTY_TABS)
  })
  it('keeps the active tab when closing another', () => {
    expect(removeTab(list, 'a').activeId).toBe('c')
  })
  it('cycles with wrap-around', () => {
    expect(neighborId(list, 1)).toBe('a')
    expect(neighborId(list, -1)).toBe('b')
  })
  it('finds tabs by path regardless of case or slashes', () => {
    expect(findByPath(list, 'c:/B.MD')?.id).toBe('b')
  })
  it('reports dirty tabs and updates immutably', () => {
    const changed = updateTab(list, 'a', { state: edited(list.tabs[0], 'new').state })
    expect(hasDirty(changed)).toBe(true)
    expect(hasDirty(list)).toBe(false)
  })
  it('reuses the lowest free untitled number', () => {
    const withUntitled = [makeTab('u1', null, '', 1), makeTab('u3', null, '', 3)].reduce(addTab, EMPTY_TABS)
    expect(nextUntitledIndex(withUntitled)).toBe(2)
  })
  it('records only saved files in the session', () => {
    const mixed = addTab(list, makeTab('u', null))
    expect(sessionOf(mixed)).toEqual({ paths: ['C:\\a.md', 'C:\\b.md', 'C:\\c.md'], activePath: null })
    expect(sessionOf(list).activePath).toBe('C:\\c.md')
  })
  it('Save As onto a file open in another, unchanged tab closes that stale tab', () => {
    const result = resolvePathClash(list, 'a', 'c:/B.md')
    expect(result.detachedId).toBeNull()
    expect(result.list.tabs.map((t) => t.id)).toEqual(['a', 'c'])
  })
  it('Save As onto a file open with unsaved edits keeps those edits as an untitled tab', () => {
    const dirtyB = updateTab(list, 'b', { state: edited(list.tabs[1], 'my unsaved work').state })
    const result = resolvePathClash(dirtyB, 'a', 'C:\\b.md')
    expect(result.detachedId).toBe('b')
    const kept = result.list.tabs.find((t) => t.id === 'b')
    expect(kept?.path).toBeNull()
    expect(kept?.state.doc.toString()).toBe('my unsaved work')
    expect(kept && isDirty(kept)).toBe(true)
    expect(result.list.tabs).toHaveLength(3)
  })
  it('ignores a clash with the tab being saved itself', () => {
    expect(resolvePathClash(list, 'b', 'C:\\b.md')).toEqual({ list, detachedId: null })
  })
  it('hints the folder when two open files share a name', () => {
    const twins = [makeTab('x', 'C:\\docs\\README.md'), makeTab('y', 'C:\\app\\README.md'), makeTab('z', 'C:\\z.md')].reduce(
      addTab,
      EMPTY_TABS
    )
    const hints = duplicateHints(twins)
    expect(hints.get('x')).toBe('docs')
    expect(hints.get('y')).toBe('app')
    expect(hints.has('z')).toBe(false)
  })
})
