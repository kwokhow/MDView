import { contextBridge, ipcRenderer, webUtils } from 'electron'
import {
  IpcInvoke,
  IpcNotify,
  IpcSend,
  type MdViewApi,
  type MenuCommand,
  type OpenedFile,
  type SaveChoice,
  type SavedFile,
  type SessionState,
  type StartupFiles,
  type ThemeName,
  type ViewPrefs
} from '../shared/types'

/** Subscribe to a main→renderer channel; returns an unsubscribe function. */
function subscribe<T>(channel: string, handler: (payload: T) => void): () => void {
  const listener = (_e: Electron.IpcRendererEvent, payload: T): void => handler(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

/**
 * The preload bridge. Only named, narrow methods are exposed — never the raw
 * ipcRenderer object. contextIsolation keeps this surface the only thing the
 * renderer can reach into the main process with.
 */
const api: MdViewApi = {
  openFileDialog: () => ipcRenderer.invoke(IpcInvoke.fileOpenDialog) as Promise<OpenedFile[]>,
  readFile: (path) => ipcRenderer.invoke(IpcInvoke.fileRead, path) as Promise<OpenedFile>,
  saveFile: (path, content) => ipcRenderer.invoke(IpcInvoke.fileSave, path, content) as Promise<void>,
  saveFileAs: (content, suggestedName) =>
    ipcRenderer.invoke(IpcInvoke.fileSaveAs, content, suggestedName) as Promise<SavedFile | null>,
  getStartupFiles: () => ipcRenderer.invoke(IpcInvoke.startupFiles) as Promise<StartupFiles>,
  askSaveChanges: (name) => ipcRenderer.invoke(IpcInvoke.askSaveChanges, name) as Promise<SaveChoice>,
  getTheme: () => ipcRenderer.invoke(IpcInvoke.themeGet) as Promise<ThemeName>,
  setTheme: (theme) => ipcRenderer.send(IpcNotify.themeSet, theme),
  getPrefs: () => ipcRenderer.invoke(IpcInvoke.prefsGet) as Promise<ViewPrefs>,
  setPrefs: (prefs: ViewPrefs) => ipcRenderer.send(IpcNotify.prefsSet, prefs),
  getLineNumbers: () => ipcRenderer.invoke(IpcInvoke.lineNumbersGet) as Promise<boolean>,
  setSession: (session: SessionState) => ipcRenderer.send(IpcNotify.sessionSet, session),
  setDirty: (dirty) => ipcRenderer.send(IpcNotify.docSetDirty, dirty),
  addRecent: (path) => ipcRenderer.send(IpcNotify.recentAdd, path),
  openExternal: (url) => ipcRenderer.send(IpcNotify.openExternal, url),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  confirmClose: () => ipcRenderer.send(IpcNotify.confirmClose),

  onLineNumbers: (handler) => subscribe<boolean>(IpcSend.lineNumbers, handler),
  onMenuCommand: (handler) => subscribe<MenuCommand>(IpcSend.menuCommand, handler),
  onOpenPath: (handler) => subscribe<string>(IpcSend.openPath, handler),
  onRequestSaveBeforeClose: (handler) => subscribe<void>(IpcSend.requestSaveBeforeClose, () => handler())
}

contextBridge.exposeInMainWorld('api', api)
