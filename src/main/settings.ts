import Store from 'electron-store'
import type { SessionState, ThemeName, ViewMode, ViewPrefs } from '../shared/types'

/** Persisted app settings: window geometry, theme, session, view preferences. */
interface SettingsSchema {
  windowBounds: { width: number; height: number; x?: number; y?: number }
  maximized: boolean
  theme: ThemeName
  /** Pre-2.0 single-file restore; read once as a fallback for an empty session. */
  lastFile: string | null
  session: SessionState
  prefs: ViewPrefs
  spellcheck: boolean
  lineNumbers: boolean
}

const VIEW_MODES: readonly ViewMode[] = ['editor', 'split', 'preview']

const DEFAULT_PREFS: ViewPrefs = {
  mode: 'split',
  splitRatio: 0.5,
  syncScroll: true,
  sidebar: true,
  zoom: 1
}

const store = new Store<SettingsSchema>({
  defaults: {
    windowBounds: { width: 1280, height: 820 },
    maximized: false,
    theme: 'light',
    lastFile: null,
    session: { paths: [], activePath: null },
    prefs: DEFAULT_PREFS,
    // Off by default: Markdown documents are full of code, identifiers and
    // product names that the dictionary flags as misspellings.
    spellcheck: false,
    lineNumbers: true
  }
})

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Coerce anything (stored or sent over IPC) into a valid ViewPrefs. */
export function normalizePrefs(raw: unknown): ViewPrefs {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof ViewPrefs, unknown>>
  return {
    mode: VIEW_MODES.includes(p.mode as ViewMode) ? (p.mode as ViewMode) : DEFAULT_PREFS.mode,
    splitRatio: clamp(finiteOr(p.splitRatio, DEFAULT_PREFS.splitRatio), 0.15, 0.85),
    syncScroll: typeof p.syncScroll === 'boolean' ? p.syncScroll : DEFAULT_PREFS.syncScroll,
    sidebar: typeof p.sidebar === 'boolean' ? p.sidebar : DEFAULT_PREFS.sidebar,
    zoom: clamp(finiteOr(p.zoom, DEFAULT_PREFS.zoom), 0.7, 2)
  }
}

/** Coerce anything into a valid SessionState (strings only, no duplicates). */
export function normalizeSession(raw: unknown): SessionState {
  const s = (raw && typeof raw === 'object' ? raw : {}) as { paths?: unknown; activePath?: unknown }
  const paths = Array.isArray(s.paths)
    ? [...new Set(s.paths.filter((p): p is string => typeof p === 'string' && p.length > 0))]
    : []
  const activePath = typeof s.activePath === 'string' && paths.includes(s.activePath) ? s.activePath : null
  return { paths, activePath }
}

export function getWindowBounds(): SettingsSchema['windowBounds'] {
  return store.get('windowBounds')
}

export function setWindowBounds(bounds: SettingsSchema['windowBounds']): void {
  store.set('windowBounds', bounds)
}

export function getMaximized(): boolean {
  return store.get('maximized')
}

export function setMaximized(value: boolean): void {
  store.set('maximized', value)
}

export function getTheme(): ThemeName {
  return store.get('theme') === 'dark' ? 'dark' : 'light'
}

export function setTheme(theme: ThemeName): void {
  store.set('theme', theme)
}

export function getPrefs(): ViewPrefs {
  return normalizePrefs(store.get('prefs'))
}

export function setPrefs(prefs: unknown): void {
  store.set('prefs', normalizePrefs(prefs))
}

export function getSession(): SessionState {
  return normalizeSession(store.get('session'))
}

export function setSession(session: unknown): void {
  store.set('session', normalizeSession(session))
}

/** Whether the browser spellchecker underlines words in the editor. */
export function getSpellcheck(): boolean {
  return store.get('spellcheck')
}

export function setSpellcheck(value: boolean): void {
  store.set('spellcheck', value)
}

/** Whether the editor shows its line-number gutter. */
export function getLineNumbers(): boolean {
  return store.get('lineNumbers')
}

export function setLineNumbers(value: boolean): void {
  store.set('lineNumbers', value)
}

/** Absolute path of the most recently opened/saved file, or null. */
export function getLastFile(): string | null {
  return store.get('lastFile')
}

export function setLastFile(path: string | null): void {
  store.set('lastFile', path)
}
