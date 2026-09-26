/**
 * Shared types and channel constants used across main, preload, and renderer.
 * Keeping these in one place keeps the IPC contract type-safe end to end.
 */

/** Request/response channels: renderer invokes, main handles and replies. */
export const IpcInvoke = {
  fileOpenDialog: 'file:openDialog',
  fileRead: 'file:read',
  fileSave: 'file:save',
  fileSaveAs: 'file:saveAs',
  startupFiles: 'app:startupFiles',
  askSaveChanges: 'app:askSaveChanges',
  themeGet: 'theme:get',
  prefsGet: 'prefs:get',
  lineNumbersGet: 'view:lineNumbersGet'
} as const

/** Fire-and-forget channels: renderer notifies main. */
export const IpcNotify = {
  docSetDirty: 'doc:setDirty',
  recentAdd: 'recent:add',
  themeSet: 'theme:set',
  prefsSet: 'prefs:set',
  sessionSet: 'session:set',
  confirmClose: 'app:confirmClose',
  openExternal: 'app:openExternal'
} as const

/** Fire-and-forget channels: main pushes to the renderer. */
export const IpcSend = {
  menuCommand: 'menu:command',
  openPath: 'file:openPath',
  requestSaveBeforeClose: 'app:requestSaveBeforeClose',
  lineNumbers: 'view:lineNumbers'
} as const

/** Commands the application menu, toolbar and shortcuts dispatch to the renderer. */
export type MenuCommand =
  | 'new'
  | 'open'
  | 'save'
  | 'saveAs'
  | 'saveAll'
  | 'closeTab'
  | 'nextTab'
  | 'prevTab'
  | 'undo'
  | 'redo'
  | 'selectAll'
  | 'find'
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'link'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'quote'
  | 'codeBlock'
  | 'table'
  | 'hr'
  | 'viewEditor'
  | 'viewSplit'
  | 'viewPreview'
  | 'toggleSync'
  | 'toggleSidebar'
  | 'toggleTheme'
  | 'zoomIn'
  | 'zoomOut'
  | 'zoomReset'

export type ThemeName = 'light' | 'dark'

/** Which panes are visible: raw editor, both side by side, or formatted preview. */
export type ViewMode = 'editor' | 'split' | 'preview'

/** Persisted layout preferences owned by the renderer. */
export interface ViewPrefs {
  mode: ViewMode
  /** Editor share of the split width, 0.15–0.85. */
  splitRatio: number
  syncScroll: boolean
  sidebar: boolean
  /** Text scale for editor and preview, 0.7–2. */
  zoom: number
}

/** The open tabs to restore on next launch. */
export interface SessionState {
  paths: string[]
  activePath: string | null
}

/** Result of opening a file. */
export interface OpenedFile {
  path: string
  content: string
}

/** Payload returned by a save-as operation. null => cancelled. */
export interface SavedFile {
  path: string
}

/** Files to open on launch (restored session plus any "open with" file). */
export interface StartupFiles {
  files: OpenedFile[]
  activePath: string | null
}

/** Answer to "save changes before closing this document?". */
export type SaveChoice = 'save' | 'discard' | 'cancel'

/** The shape exposed on window.api by the preload bridge. */
export interface MdViewApi {
  /** Show the open dialog (multi-select); resolves to the files read, [] if cancelled. */
  openFileDialog: () => Promise<OpenedFile[]>
  /** Read a file's text content by absolute path. */
  readFile: (path: string) => Promise<OpenedFile>
  /** Save content to an existing path. */
  saveFile: (path: string, content: string) => Promise<void>
  /** Show save-as dialog, write content, return new path or null if cancelled. */
  saveFileAs: (content: string, suggestedName?: string) => Promise<SavedFile | null>
  /** Restored session plus any file passed on the command line, already read. */
  getStartupFiles: () => Promise<StartupFiles>
  /** Native Save / Don't Save / Cancel prompt for one document. */
  askSaveChanges: (name: string) => Promise<SaveChoice>
  getTheme: () => Promise<ThemeName>
  setTheme: (theme: ThemeName) => void
  getPrefs: () => Promise<ViewPrefs>
  setPrefs: (prefs: ViewPrefs) => void
  /** Read the persisted line-number preference (editor gutter). */
  getLineNumbers: () => Promise<boolean>
  /** Persist which files are open so the next launch restores them. */
  setSession: (session: SessionState) => void
  /** Inform main whether any open document has unsaved changes. */
  setDirty: (dirty: boolean) => void
  /** Add a path to the OS recent-documents / jump list. */
  addRecent: (path: string) => void
  /** Open an http(s)/mailto link in the system browser. Other schemes are ignored. */
  openExternal: (url: string) => void
  /** Absolute path of a file dropped onto the window. */
  getPathForFile: (file: File) => string
  /** Subscribe to line-number preference changes made from the View menu. */
  onLineNumbers: (handler: (enabled: boolean) => void) => () => void
  /** Subscribe to menu/shortcut commands from main. Returns an unsubscribe fn. */
  onMenuCommand: (handler: (command: MenuCommand) => void) => () => void
  /** Subscribe to "open this path" requests (second instance, jump list). */
  onOpenPath: (handler: (path: string) => void) => () => void
  /** Subscribe to a save-before-close request from main; reply via confirmClose. */
  onRequestSaveBeforeClose: (handler: () => void) => () => void
  /** Tell main it is safe to close the window now (after saves completed). */
  confirmClose: () => void
}
