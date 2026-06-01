/**
 * Immutable current-document state. Every change returns a new object rather
 * than mutating in place (project coding-style rule).
 */
export interface DocumentState {
  /** Absolute path on disk, or null for an unsaved new document. */
  readonly path: string | null
  /** Display name shown in the title/status bar. */
  readonly name: string
  /** Whether the buffer differs from what is on disk. */
  readonly dirty: boolean
}

export const UNTITLED_NAME = 'Untitled'

export function createEmptyDocument(): DocumentState {
  return { path: null, name: UNTITLED_NAME, dirty: false }
}

/** Return a new state representing a freshly opened/saved file at `path`. */
export function withSavedPath(state: DocumentState, path: string, name: string): DocumentState {
  return { ...state, path, name, dirty: false }
}

/** Return a new state with the dirty flag set. */
export function withDirty(state: DocumentState, dirty: boolean): DocumentState {
  if (state.dirty === dirty) return state
  return { ...state, dirty }
}

/** Return a fresh untitled, clean document. */
export function resetDocument(): DocumentState {
  return createEmptyDocument()
}

/** Title-bar / status text including the dirty marker. */
export function titleFor(state: DocumentState): string {
  return `${state.dirty ? '● ' : ''}${state.name}`
}
