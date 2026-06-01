import { ipcMain, BrowserWindow } from 'electron'
import { IpcInvoke, type ThemeName } from '../shared/types'
import {
  openFileViaDialog,
  readMarkdownFile,
  saveToPath,
  saveViaDialog,
  addRecentDocument
} from './files'
import { getTheme, setTheme } from './settings'

/** Callbacks the window owner provides so IPC can update per-window state. */
interface IpcHooks {
  /** Called when the renderer reports a dirty-state change. */
  onDirtyChange: (win: BrowserWindow, dirty: boolean) => void
  /** Called when the renderer confirms it is safe to close. */
  onConfirmClose: (win: BrowserWindow) => void
}

function ownerWindow(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

/** Wire all main-process IPC handlers. Call once during app startup. */
export function registerIpc(hooks: IpcHooks): void {
  ipcMain.handle(IpcInvoke.fileOpenDialog, async (event) => {
    const win = ownerWindow(event)
    if (!win) return null
    const opened = await openFileViaDialog(win)
    if (opened) addRecentDocument(opened.path)
    return opened
  })

  ipcMain.handle(IpcInvoke.fileRead, async (_event, path: string) => {
    const opened = await readMarkdownFile(path)
    addRecentDocument(path)
    return opened
  })

  ipcMain.handle(IpcInvoke.fileSave, async (_event, path: string, content: string) => {
    await saveToPath(path, content)
  })

  ipcMain.handle(
    IpcInvoke.fileSaveAs,
    async (event, content: string, suggestedName?: string) => {
      const win = ownerWindow(event)
      if (!win) return null
      const saved = await saveViaDialog(win, content, suggestedName)
      if (saved) addRecentDocument(saved.path)
      return saved
    }
  )

  ipcMain.handle(IpcInvoke.themeGet, (): ThemeName => getTheme())

  ipcMain.on(IpcInvoke.themeSet, (_event, theme: ThemeName) => {
    setTheme(theme)
  })

  ipcMain.on(IpcInvoke.docSetDirty, (event, dirty: boolean) => {
    const win = ownerWindow(event)
    if (win) hooks.onDirtyChange(win, dirty)
  })

  ipcMain.on(IpcInvoke.recentAdd, (_event, path: string) => {
    addRecentDocument(path)
  })

  ipcMain.on(IpcInvoke.confirmClose, (event) => {
    const win = ownerWindow(event)
    if (win) hooks.onConfirmClose(win)
  })
}
