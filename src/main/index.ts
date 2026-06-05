import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { app, BrowserWindow, dialog, nativeImage } from 'electron'
import { IpcSend } from '../shared/types'
import { registerIpc } from './ipc'
import { buildMenu } from './menu'
import { configureAboutPanel } from './about'
import {
  getWindowBounds,
  setWindowBounds,
  getMaximized,
  setMaximized,
  getLastFile
} from './settings'

let mainWindow: BrowserWindow | null = null

/** Resolve the app icon for the window/taskbar across dev and packaged builds. */
function windowIcon(): Electron.NativeImage | undefined {
  const candidates = [
    join(process.resourcesPath ?? '', 'icon.png'),
    join(app.getAppPath(), 'build', 'icon.png'),
    join(app.getAppPath(), '..', 'build', 'icon.png')
  ]
  for (const path of candidates) {
    const img = nativeImage.createFromPath(path)
    if (!img.isEmpty()) return img
  }
  return undefined
}

/** Per-window close-guard state. Single-window app, but kept explicit. */
let isDirty = false
let forceClose = false
/** A file path requested before the window/renderer was ready. */
let pendingOpenPath: string | null = null

/** Find a markdown path among CLI args (Windows "open with" / jump list). */
function findPathInArgv(argv: string[]): string | null {
  // Skip the executable (and, in dev, the script path). Match an existing file
  // with a markdown-ish extension.
  const candidates = argv.slice(1).filter((a) => !a.startsWith('-'))
  for (const c of candidates) {
    if (/\.(md|markdown|mdown|mkd|txt)$/i.test(c) && existsSync(c)) return c
  }
  return null
}

function sendOpenPath(path: string): void {
  if (mainWindow && mainWindow.webContents) {
    if (mainWindow.webContents.isLoading()) {
      pendingOpenPath = path
    } else {
      mainWindow.webContents.send(IpcSend.openPath, path)
    }
  } else {
    pendingOpenPath = path
  }
}

function createWindow(): void {
  const bounds = getWindowBounds()

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 480,
    minHeight: 360,
    show: false,
    backgroundColor: '#ffffff',
    title: 'MDView',
    icon: windowIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (getMaximized()) mainWindow.maximize()

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // Persist geometry.
  const saveBounds = (): void => {
    if (!mainWindow) return
    setMaximized(mainWindow.isMaximized())
    if (!mainWindow.isMaximized() && !mainWindow.isMinimized()) {
      setWindowBounds(mainWindow.getBounds())
    }
  }
  mainWindow.on('resize', saveBounds)
  mainWindow.on('move', saveBounds)

  // Dirty-state close guard.
  mainWindow.on('close', (event) => {
    if (forceClose || !isDirty || !mainWindow) return
    event.preventDefault()
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      title: 'Unsaved changes',
      message: 'You have unsaved changes. Save before closing?'
    })
    if (choice === 0) {
      // Ask renderer to save; it calls confirmClose() when done.
      mainWindow.webContents.send(IpcSend.requestSaveBeforeClose)
    } else if (choice === 1) {
      forceClose = true
      mainWindow.destroy()
    }
    // choice === 2 (Cancel): keep the window open.
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Flush any pending open-path once the renderer has loaded.
  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingOpenPath) {
      mainWindow?.webContents.send(IpcSend.openPath, pendingOpenPath)
      pendingOpenPath = null
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Single-instance lock: route file opens to the running instance.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const path = findPathInArgv(argv)
    if (path) sendOpenPath(path)
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    registerIpc({
      onDirtyChange: (_win, dirty) => {
        isDirty = dirty
      },
      onConfirmClose: (win) => {
        forceClose = true
        win.destroy()
      }
    })
    configureAboutPanel()
    buildMenu()
    createWindow()

    // Open a file passed on the command line (file association / "open with").
    // If none was given, reopen the last file from the previous session, as
    // long as it still exists on disk.
    const initialPath = findPathInArgv(process.argv)
    if (initialPath) {
      sendOpenPath(initialPath)
    } else {
      const lastFile = getLastFile()
      if (lastFile && existsSync(lastFile)) sendOpenPath(lastFile)
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
