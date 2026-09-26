import type { EditorState, Text } from '@codemirror/state'
import type { SessionState } from '../../shared/types'
import { basename, samePath } from './paths'

/**
 * One open document. The editor state carries the text, cursor and undo
 * history, so switching tabs restores exactly where the user left off.
 */
export interface Tab {
  readonly id: string
  /** Absolute path on disk, or null for an unsaved new document. */
  readonly path: string | null
  /** 1 → "Untitled", 2 → "Untitled-2" … (only meaningful when path is null). */
  readonly untitledIndex: number
  readonly state: EditorState
  /** The text as last loaded or saved; the tab is dirty when it differs. */
  readonly savedDoc: Text
  readonly editorScroll: number
  readonly previewScroll: number
}

/** All open tabs, in display order, plus which one is active. */
export interface TabList {
  readonly tabs: readonly Tab[]
  readonly activeId: string | null
}

export const EMPTY_TABS: TabList = { tabs: [], activeId: null }

export function tabName(tab: Tab): string {
  if (tab.path) return basename(tab.path)
  return tab.untitledIndex <= 1 ? 'Untitled' : `Untitled-${tab.untitledIndex}`
}

export function isDirty(tab: Tab): boolean {
  return !tab.state.doc.eq(tab.savedDoc)
}

/** An untitled, unchanged tab (e.g. the welcome page) that can be replaced silently. */
export function isDisposable(tab: Tab): boolean {
  return tab.path === null && !isDirty(tab)
}

export function getTab(list: TabList, id: string): Tab | undefined {
  return list.tabs.find((t) => t.id === id)
}

export function getActive(list: TabList): Tab | null {
  return list.activeId ? (getTab(list, list.activeId) ?? null) : null
}

export function findByPath(list: TabList, path: string): Tab | undefined {
  return list.tabs.find((t) => t.path !== null && samePath(t.path, path))
}

export function hasDirty(list: TabList): boolean {
  return list.tabs.some(isDirty)
}

/** Append a tab and make it active. */
export function addTab(list: TabList, tab: Tab): TabList {
  return { tabs: [...list.tabs, tab], activeId: tab.id }
}

/** Remove a tab; if it was active, activate its right neighbour (else left). */
export function removeTab(list: TabList, id: string): TabList {
  const index = list.tabs.findIndex((t) => t.id === id)
  if (index < 0) return list
  const tabs = list.tabs.filter((t) => t.id !== id)
  if (list.activeId !== id) return { tabs, activeId: list.activeId }
  const next = tabs[Math.min(index, tabs.length - 1)]
  return { tabs, activeId: next ? next.id : null }
}

export function updateTab(list: TabList, id: string, patch: Partial<Omit<Tab, 'id'>>): TabList {
  return { ...list, tabs: list.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)) }
}

export function setActive(list: TabList, id: string): TabList {
  return getTab(list, id) ? { ...list, activeId: id } : list
}

/** The tab `delta` places from the active one, wrapping around. */
export function neighborId(list: TabList, delta: number): string | null {
  if (list.tabs.length === 0) return null
  const index = Math.max(0, list.tabs.findIndex((t) => t.id === list.activeId))
  const next = (index + delta + list.tabs.length * 16) % list.tabs.length
  return list.tabs[next].id
}

/** Lowest untitled number not already in use. */
export function nextUntitledIndex(list: TabList): number {
  const used = new Set(list.tabs.filter((t) => t.path === null).map((t) => t.untitledIndex))
  let n = 1
  while (used.has(n)) n++
  return n
}

/**
 * Tab `id` has just been saved as `path`. Any *other* tab already showing that
 * file now shows stale content: if it is unchanged it is closed; if it holds
 * unsaved edits it is kept as an untitled document, so the edits survive even
 * though the file they belonged to was overwritten. `detachedId` is that tab.
 */
export function resolvePathClash(
  list: TabList,
  id: string,
  path: string
): { list: TabList; detachedId: string | null } {
  const clash = list.tabs.find((t) => t.id !== id && t.path !== null && samePath(t.path, path))
  if (!clash) return { list, detachedId: null }
  if (!isDirty(clash)) return { list: removeTab(list, clash.id), detachedId: null }
  const untitledIndex = nextUntitledIndex(list)
  return { list: updateTab(list, clash.id, { path: null, untitledIndex }), detachedId: clash.id }
}

/** Tabs with a file on disk, for restoring on next launch. */
export function sessionOf(list: TabList): SessionState {
  const paths = list.tabs.flatMap((t) => (t.path ? [t.path] : []))
  const active = getActive(list)
  return { paths, activePath: active?.path ?? null }
}

/** Short folder hint for tabs whose file names collide ("README.md · docs"). */
export function duplicateHints(list: TabList): Map<string, string> {
  const byName = new Map<string, Tab[]>()
  for (const tab of list.tabs) {
    const name = tabName(tab).toLowerCase()
    byName.set(name, [...(byName.get(name) ?? []), tab])
  }
  const hints = new Map<string, string>()
  for (const group of byName.values()) {
    if (group.length < 2) continue
    for (const tab of group) {
      if (!tab.path) continue
      const parts = tab.path.split(/[\\/]/)
      hints.set(tab.id, parts[parts.length - 2] ?? '')
    }
  }
  return hints
}
