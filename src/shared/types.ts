/**
 * Shared types and channel constants used across main, preload, and renderer.
 * Keeping these in one place keeps the IPC contract type-safe end to end.
 */

/** IPC channels invoked from the renderer and handled in main (request/response). */
export const IpcInvoke = {
  fileOpenDialog: 'file:openDialog',
  fileRead: 'file:read',
  fileSave: 'file:save',
  fileSaveAs: 'file:saveAs',
  docSetDirty: 'doc:setDirty',
  recentAdd: 'recent:add',
  themeGet: 'theme:get',
  themeSet: 'theme:set',
  confirmClose: 'app:confirmClose',
  startupFile: 'app:startupFile'
} as const

/** IPC channels pushed from main to the renderer (fire and forget). */
export const IpcSend = {
  menuCommand: 'menu:command',
  openPath: 'file:openPath',
  requestSaveBeforeClose: 'app:requestSaveBeforeClose'
} as const

/** Commands the application menu / shortcuts dispatch to the renderer. */
export type MenuCommand =
  | 'new'
  | 'open'
  | 'save'
  | 'saveAs'
  | 'find'
  | 'toggleTheme'
  | 'toggleReading'
  | 'zoomIn'
  | 'zoomOut'
  | 'zoomReset'

export type ThemeName = 'light' | 'dark'

/** Result of opening a file (dialog or path). null path => user cancelled. */
export interface OpenedFile {
  path: string
  content: string
}

/** Payload returned by a save-as operation. null => cancelled. */
export interface SavedFile {
  path: string
}

/** The shape exposed on window.api by the preload bridge. */
export interface MdViewApi {
  /** Show the open dialog, return the chosen file's path + content, or null if cancelled. */
  openFileDialog: () => Promise<OpenedFile | null>
  /** Read a file's text content by absolute path. */
  readFile: (path: string) => Promise<OpenedFile>
  /** Save content to an existing path. */
  saveFile: (path: string, content: string) => Promise<void>
  /** Show save-as dialog, write content, return new path or null if cancelled. */
  saveFileAs: (content: string, suggestedName?: string) => Promise<SavedFile | null>
  /** Inform main whether the current document has unsaved changes. */
  setDirty: (dirty: boolean) => void
  /** Add a path to the OS recent-documents / jump list. */
  addRecent: (path: string) => void
  /**
   * The file to open on startup (CLI/"open with" arg, else the last session's
   * file if it still exists), already read. null if there is none — the
   * renderer then shows the welcome document. Resolved once, before mount, so
   * the editor mounts a single time with the correct content.
   */
  getStartupFile: () => Promise<OpenedFile | null>
  /** Read the persisted theme. */
  getTheme: () => Promise<ThemeName>
  /** Persist the theme. */
  setTheme: (theme: ThemeName) => void
  /** Subscribe to menu/shortcut commands from main. Returns an unsubscribe fn. */
  onMenuCommand: (handler: (command: MenuCommand) => void) => () => void
  /** Subscribe to "open this path" requests (CLI arg, jump list, second instance). */
  onOpenPath: (handler: (path: string) => void) => () => void
  /** Subscribe to a save-before-close request from main; reply via confirmClose. */
  onRequestSaveBeforeClose: (handler: () => void) => () => void
  /** Tell main it is safe to close the window now (after a save completed). */
  confirmClose: () => void
}
