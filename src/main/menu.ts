import { Menu, BrowserWindow, shell, type MenuItemConstructorOptions } from 'electron'
import { IpcSend, type MenuCommand } from '../shared/types'
import { showAbout } from './about'

/** Send a menu command to the focused window's renderer. */
function dispatch(command: MenuCommand): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  win?.webContents.send(IpcSend.menuCommand, command)
}

/** Build and install the application menu with accelerators. */
export function buildMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => dispatch('new') },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => dispatch('open') },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => dispatch('save') },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => dispatch('saveAs') },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find…', accelerator: 'CmdOrCtrl+F', click: () => dispatch('find') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reading Mode', accelerator: 'CmdOrCtrl+/', click: () => dispatch('toggleReading') },
        { label: 'Toggle Theme', accelerator: 'CmdOrCtrl+\\', click: () => dispatch('toggleTheme') },
        { type: 'separator' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: () => dispatch('zoomIn') },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => dispatch('zoomOut') },
        { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', click: () => dispatch('zoomReset') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Markdown Guide',
          click: () => shell.openExternal('https://www.markdownguide.org/basic-syntax/')
        },
        { type: 'separator' },
        { label: 'About MDView', click: () => void showAbout() }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
