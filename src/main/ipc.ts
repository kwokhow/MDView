import { ipcMain, BrowserWindow, dialog } from 'electron'
import {
  IpcInvoke,
  IpcNotify,
  type SaveChoice,
  type StartupFiles,
  type ThemeName,
  type ViewPrefs
} from '../shared/types'
import {
  openFilesViaDialog,
  readMarkdownFile,
  readMarkdownFiles,
  saveToPath,
  saveViaDialog,
  addRecentDocument
} from './files'
import { openExternalSafe } from './external'
import {
  getTheme,
  setTheme,
  setLastFile,
  getLineNumbers,
  getPrefs,
  setPrefs,
  setSession
} from './settings'

/** Callbacks the window owner provides so IPC can reach per-window state. */
interface IpcHooks {
  /** Paths to open on launch and which one should be active. */
  getStartupPaths: () => { paths: string[]; activePath: string | null }
  /** Called when the renderer reports whether any document is unsaved. */
  onDirtyChange: (win: BrowserWindow, dirty: boolean) => void
  /** Called when the renderer confirms it is safe to close. */
  onConfirmClose: (win: BrowserWindow) => void
}

type IpcEvent = Electron.IpcMainEvent | Electron.IpcMainInvokeEvent

function ownerWindow(event: IpcEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

/** Reject anything that is not a non-empty string before it reaches the filesystem. */
function requirePath(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error('Invalid path')
  return value
}

function requireText(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid content')
  return value
}

function rememberOpened(path: string): void {
  addRecentDocument(path)
  setLastFile(path)
}

async function askSaveChanges(win: BrowserWindow | null, name: unknown): Promise<SaveChoice> {
  const label = typeof name === 'string' && name.length > 0 ? name : 'this document'
  const options: Electron.MessageBoxOptions = {
    type: 'warning',
    buttons: ['Save', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    noLink: true,
    title: 'Unsaved changes',
    message: `Do you want to save the changes you made to ${label}?`,
    detail: "Your changes will be lost if you don't save them."
  }
  const { response } = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options)
  return response === 0 ? 'save' : response === 1 ? 'discard' : 'cancel'
}

/** Wire all main-process IPC handlers. Call once during app startup. */
export function registerIpc(hooks: IpcHooks): void {
  ipcMain.handle(IpcInvoke.fileOpenDialog, async (event) => {
    const win = ownerWindow(event)
    if (!win) return []
    const opened = await openFilesViaDialog(win)
    opened.forEach((f) => rememberOpened(f.path))
    return opened
  })

  ipcMain.handle(IpcInvoke.fileRead, async (_event, path: unknown) => {
    const opened = await readMarkdownFile(requirePath(path))
    rememberOpened(opened.path)
    return opened
  })

  ipcMain.handle(IpcInvoke.fileSave, async (_event, path: unknown, content: unknown) => {
    await saveToPath(requirePath(path), requireText(content))
  })

  ipcMain.handle(IpcInvoke.fileSaveAs, async (event, content: unknown, suggestedName: unknown) => {
    const win = ownerWindow(event)
    if (!win) return null
    const name = typeof suggestedName === 'string' ? suggestedName : undefined
    const saved = await saveViaDialog(win, requireText(content), name)
    if (saved) rememberOpened(saved.path)
    return saved
  })

  ipcMain.handle(IpcInvoke.startupFiles, async (): Promise<StartupFiles> => {
    const { paths, activePath } = hooks.getStartupPaths()
    const files = await readMarkdownFiles(paths)
    files.forEach((f) => addRecentDocument(f.path))
    const active = files.some((f) => f.path === activePath) ? activePath : (files.at(-1)?.path ?? null)
    return { files, activePath: active }
  })

  ipcMain.handle(IpcInvoke.askSaveChanges, (event, name: unknown) =>
    askSaveChanges(ownerWindow(event), name)
  )

  ipcMain.handle(IpcInvoke.themeGet, (): ThemeName => getTheme())
  ipcMain.handle(IpcInvoke.prefsGet, (): ViewPrefs => getPrefs())
  ipcMain.handle(IpcInvoke.lineNumbersGet, (): boolean => getLineNumbers())

  ipcMain.on(IpcNotify.themeSet, (_event, theme: unknown) => {
    if (theme === 'light' || theme === 'dark') setTheme(theme)
  })

  // settings.ts normalizes both payloads, so malformed values are coerced, not stored.
  ipcMain.on(IpcNotify.prefsSet, (_event, prefs: unknown) => setPrefs(prefs))
  ipcMain.on(IpcNotify.sessionSet, (_event, session: unknown) => setSession(session))

  ipcMain.on(IpcNotify.docSetDirty, (event, dirty: unknown) => {
    const win = ownerWindow(event)
    if (win) hooks.onDirtyChange(win, dirty === true)
  })

  ipcMain.on(IpcNotify.recentAdd, (_event, path: unknown) => {
    if (typeof path === 'string' && path.length > 0) addRecentDocument(path)
  })

  ipcMain.on(IpcNotify.openExternal, (_event, url: unknown) => openExternalSafe(url))

  ipcMain.on(IpcNotify.confirmClose, (event) => {
    const win = ownerWindow(event)
    if (win) hooks.onConfirmClose(win)
  })
}
