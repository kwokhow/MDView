import { Menu, BrowserWindow, shell, type MenuItemConstructorOptions } from 'electron'
import { IpcSend, type MenuCommand } from '../shared/types'
import { showAbout } from './about'
import { getSpellcheck, setSpellcheck, getLineNumbers, setLineNumbers } from './settings'

/** Send a menu command to the focused window's renderer. */
function dispatch(command: MenuCommand): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  win?.webContents.send(IpcSend.menuCommand, command)
}

/** Shorthand for a menu item that dispatches a renderer command. */
function item(label: string, command: MenuCommand, accelerator?: string): MenuItemConstructorOptions {
  return { label, accelerator, click: () => dispatch(command) }
}

/**
 * Persist the spellcheck preference and apply it to every open window without
 * needing a restart. The new state is derived from the stored value rather than
 * the menu item's `checked` flag, so the setting stays authoritative and the
 * item is re-synced to match it.
 */
function toggleSpellcheck(menuItem: Electron.MenuItem): void {
  const enabled = !getSpellcheck()
  setSpellcheck(enabled)
  menuItem.checked = enabled
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.session.setSpellCheckerEnabled(enabled)
  }
}

/** Persist the line-number preference and push it to every renderer. */
function toggleLineNumbers(menuItem: Electron.MenuItem): void {
  const enabled = !getLineNumbers()
  setLineNumbers(enabled)
  menuItem.checked = enabled
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IpcSend.lineNumbers, enabled)
  }
}

/** Build and install the application menu with accelerators. */
export function buildMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        item('New Tab', 'new', 'CmdOrCtrl+N'),
        item('Open…', 'open', 'CmdOrCtrl+O'),
        { type: 'separator' },
        item('Save', 'save', 'CmdOrCtrl+S'),
        item('Save As…', 'saveAs', 'CmdOrCtrl+Shift+S'),
        item('Save All', 'saveAll', 'CmdOrCtrl+Alt+S'),
        { type: 'separator' },
        item('Close Tab', 'closeTab', 'CmdOrCtrl+W'),
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        // Undo/redo/select-all go through the renderer so they act on the
        // editor's own history and whole document, not just the rendered lines.
        item('Undo', 'undo', 'CmdOrCtrl+Z'),
        item('Redo', 'redo', 'CmdOrCtrl+Y'),
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        item('Select All', 'selectAll', 'CmdOrCtrl+A'),
        { type: 'separator' },
        item('Find / Replace…', 'find', 'CmdOrCtrl+F')
      ]
    },
    {
      label: 'Format',
      submenu: [
        item('Bold', 'bold', 'CmdOrCtrl+B'),
        item('Italic', 'italic', 'CmdOrCtrl+I'),
        item('Strikethrough', 'strike', 'CmdOrCtrl+Shift+X'),
        item('Inline Code', 'code', 'CmdOrCtrl+E'),
        item('Link', 'link', 'CmdOrCtrl+K'),
        { type: 'separator' },
        item('Heading 1', 'heading1', 'CmdOrCtrl+1'),
        item('Heading 2', 'heading2', 'CmdOrCtrl+2'),
        item('Heading 3', 'heading3', 'CmdOrCtrl+3'),
        { type: 'separator' },
        item('Bulleted List', 'bulletList'),
        item('Numbered List', 'orderedList'),
        item('Task List', 'taskList'),
        item('Quote', 'quote'),
        { type: 'separator' },
        item('Code Block', 'codeBlock'),
        item('Table', 'table'),
        item('Horizontal Rule', 'hr')
      ]
    },
    {
      label: 'View',
      submenu: [
        item('Editor Only', 'viewEditor', 'CmdOrCtrl+Alt+1'),
        item('Split View', 'viewSplit', 'CmdOrCtrl+Alt+2'),
        item('Preview Only', 'viewPreview', 'CmdOrCtrl+Alt+3'),
        { type: 'separator' },
        item('Toggle Sync Scroll', 'toggleSync'),
        item('Toggle Sidebar', 'toggleSidebar', 'CmdOrCtrl+Alt+B'),
        item('Toggle Theme', 'toggleTheme', 'CmdOrCtrl+\\'),
        { type: 'separator' },
        {
          label: 'Line Numbers',
          type: 'checkbox',
          checked: getLineNumbers(),
          click: (menuItem) => toggleLineNumbers(menuItem)
        },
        {
          label: 'Check Spelling',
          type: 'checkbox',
          checked: getSpellcheck(),
          click: (menuItem) => toggleSpellcheck(menuItem)
        },
        { type: 'separator' },
        item('Next Tab', 'nextTab', 'Ctrl+Tab'),
        item('Previous Tab', 'prevTab', 'Ctrl+Shift+Tab'),
        { type: 'separator' },
        item('Zoom In', 'zoomIn', 'CmdOrCtrl+='),
        item('Zoom Out', 'zoomOut', 'CmdOrCtrl+-'),
        item('Reset Zoom', 'zoomReset', 'CmdOrCtrl+0'),
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
