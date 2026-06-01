import { contextBridge, ipcRenderer } from 'electron'
import {
  IpcInvoke,
  IpcSend,
  type MdViewApi,
  type MenuCommand,
  type OpenedFile,
  type SavedFile,
  type ThemeName
} from '../shared/types'

/**
 * The preload bridge. Only named, narrow methods are exposed — never the raw
 * ipcRenderer object. contextIsolation keeps this surface the only thing the
 * renderer can reach into the main process with.
 */
const api: MdViewApi = {
  openFileDialog: () => ipcRenderer.invoke(IpcInvoke.fileOpenDialog) as Promise<OpenedFile | null>,
  readFile: (path: string) => ipcRenderer.invoke(IpcInvoke.fileRead, path) as Promise<OpenedFile>,
  saveFile: (path: string, content: string) =>
    ipcRenderer.invoke(IpcInvoke.fileSave, path, content) as Promise<void>,
  saveFileAs: (content: string, suggestedName?: string) =>
    ipcRenderer.invoke(IpcInvoke.fileSaveAs, content, suggestedName) as Promise<SavedFile | null>,
  setDirty: (dirty: boolean) => ipcRenderer.send(IpcInvoke.docSetDirty, dirty),
  addRecent: (path: string) => ipcRenderer.send(IpcInvoke.recentAdd, path),
  getTheme: () => ipcRenderer.invoke(IpcInvoke.themeGet) as Promise<ThemeName>,
  setTheme: (theme: ThemeName) => ipcRenderer.send(IpcInvoke.themeSet, theme),
  confirmClose: () => ipcRenderer.send(IpcInvoke.confirmClose),

  onMenuCommand: (handler: (command: MenuCommand) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, command: MenuCommand) => handler(command)
    ipcRenderer.on(IpcSend.menuCommand, listener)
    return () => ipcRenderer.removeListener(IpcSend.menuCommand, listener)
  },
  onOpenPath: (handler: (path: string) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, path: string) => handler(path)
    ipcRenderer.on(IpcSend.openPath, listener)
    return () => ipcRenderer.removeListener(IpcSend.openPath, listener)
  },
  onRequestSaveBeforeClose: (handler: () => void) => {
    const listener = () => handler()
    ipcRenderer.on(IpcSend.requestSaveBeforeClose, listener)
    return () => ipcRenderer.removeListener(IpcSend.requestSaveBeforeClose, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
