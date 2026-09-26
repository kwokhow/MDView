import { join, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { app, BrowserWindow, dialog, nativeImage } from 'electron'
import { IpcSend } from '../shared/types'
import { registerIpc } from './ipc'
import { buildMenu } from './menu'
import { configureAboutPanel } from './about'
import { openExternalSafe } from './external'
import {
  getWindowBounds,
  setWindowBounds,
  getMaximized,
  setMaximized,
  getLastFile,
  getSession,
  getSpellcheck,
  getTheme
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
/** "Open with" file from the launch command line; consumed by the first startup request. */
let launchPath: string | null = null

/** Find a markdown path among CLI args (Windows "open with" / jump list). */
function findPathInArgv(argv: string[]): string | null {
  // Skip the executable (and, in dev, the script path). Match an existing file
  // with a markdown-ish extension.
  const candidates = argv.slice(1).filter((a) => !a.startsWith('-'))
  for (const c of candidates) {
    if (/\.(md|markdown|mdown|mkd|mkdn|txt)$/i.test(c) && existsSync(c)) return c
  }
  return null
}

/** Windows paths are case-insensitive; compare them that way. */
function samePath(a: string, b: string): boolean {
  return resolve(a).toLowerCase() === resolve(b).toLowerCase()
}

/**
 * Files to open when the renderer boots: the previous session's tabs that
 * still exist (falling back to the pre-2.0 single "last file"), plus the
 * "open with" file, which becomes the active tab.
 */
function startupPaths(): { paths: string[]; activePath: string | null } {
  const session = getSession()
  let paths = session.paths.filter((p) => existsSync(p))
  if (paths.length === 0) {
    const last = getLastFile()
    if (last && existsSync(last)) paths = [last]
  }
  let activePath =
    session.activePath && paths.includes(session.activePath) ? session.activePath : (paths.at(-1) ?? null)

  const cli = launchPath
  launchPath = null
  if (cli) {
    const existing = paths.find((p) => samePath(p, cli))
    if (!existing) paths = [...paths, cli]
    activePath = existing ?? cli
  }
  return { paths, activePath }
}

function sendOpenPath(path: string): void {
  if (mainWindow && !mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send(IpcSend.openPath, path)
  } else {
    pendingOpenPath = path
  }
}

/**
 * The preview renders arbitrary document content. Never let a link (or a
 * dropped file) navigate the app window away; hand web links to the browser.
 */
function hardenNavigation(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafe(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (url === win.webContents.getURL()) return
    event.preventDefault()
    openExternalSafe(url)
  })
}

function createWindow(): void {
  const bounds = getWindowBounds()

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 640,
    minHeight: 420,
    show: false,
    backgroundColor: getTheme() === 'dark' ? '#0d1117' : '#ffffff',
    title: 'MDView',
    icon: windowIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Markdown is full of identifiers and code the dictionary flags as
      // misspellings, so this is off unless enabled from View > Check Spelling.
      spellcheck: getSpellcheck()
    }
  })

  if (getMaximized()) mainWindow.maximize()

  // webPreferences.spellcheck is only read at creation; also drive the session
  // so the View > Check Spelling toggle and this initial state agree.
  mainWindow.webContents.session.setSpellCheckerEnabled(getSpellcheck())
  hardenNavigation(mainWindow)

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
      type: 'warning',
      buttons: ['Save All', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
      title: 'Unsaved changes',
      message: 'Some documents have unsaved changes. Save them before closing?'
    })
    if (choice === 0) {
      // Ask renderer to save everything; it calls confirmClose() when done.
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
    launchPath = findPathInArgv(process.argv)

    registerIpc({
      getStartupPaths: startupPaths,
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

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
