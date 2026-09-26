import './styles/app.css'
import './styles/preview.css'
import logoUrl from '../../build/icon.png'
import { FilePlus, FolderOpen, Plus } from 'lucide'
import type { EditorState, TransactionSpec } from '@codemirror/state'
import type { MenuCommand, StartupFiles, ThemeName, ViewPrefs } from '../shared/types'
import { insertBlock, insertLink, toggleInline, toggleLineBlock } from './lib/format'
import { isMarkdownPath } from './lib/paths'
import { EditorPane } from './ui/editor-pane'
import { PreviewPane } from './ui/preview-pane'
import { ScrollSync } from './ui/scroll-sync'
import { OutlineView } from './ui/outline'
import { FileList, TabStrip, type TabHandlers } from './ui/tab-views'
import { StatusBar } from './ui/status-bar'
import { Layout } from './ui/layout'
import { Toolbar } from './ui/toolbar'
import { FindBar } from './ui/find-bar'
import { applyTheme, nextTheme } from './ui/theme'
import { icon } from './ui/icons'
import { Workbench } from './app/workbench'
import { WELCOME } from './app/welcome'

const DEFAULT_PREFS: ViewPrefs = { mode: 'split', splitRatio: 0.5, syncScroll: true, sidebar: true, zoom: 1 }

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`Missing element #${id}`)
  return el as T
}

/** A failed settings read must never stop the editor from starting. */
async function settle<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise
  } catch {
    return fallback
  }
}

function focusedTextField(): HTMLInputElement | HTMLTextAreaElement | null {
  const el = document.activeElement
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el : null
}

async function init(): Promise<void> {
  const [savedTheme, prefs, lineNumbers, startup] = await Promise.all([
    settle<ThemeName>(window.api.getTheme(), 'light'),
    settle<ViewPrefs>(window.api.getPrefs(), DEFAULT_PREFS),
    settle<boolean>(window.api.getLineNumbers(), true),
    settle<StartupFiles>(window.api.getStartupFiles(), { files: [], activePath: null })
  ])
  let theme = savedTheme
  applyTheme(theme)

  byId<HTMLImageElement>('brand-logo').src = logoUrl
  byId('side-new').append(icon(FilePlus))
  byId('side-open').append(icon(FolderOpen))
  byId('tab-new').append(icon(Plus))

  // Components call back into the workbench, which is built from them below.
  let workbench: Workbench | undefined

  const status = new StatusBar({
    path: byId('status-path'),
    saved: byId('status-saved'),
    message: byId('status-message'),
    cursor: byId('status-cursor'),
    stats: byId('status-stats'),
    theme: byId('status-theme')
  })
  const editor = new EditorPane(byId('editor-pane'), {
    onDocChange: (state) => workbench?.onDocChange(state),
    onCursor: (line, column) => status.setCursor(line, column),
    onScroll: () => workbench?.onEditorScroll()
  })
  editor.setLineNumbers(lineNumbers)
  const preview = new PreviewPane(byId('preview-scroller'), byId('preview'), {
    onScroll: () => workbench?.onPreviewScroll(),
    onLink: (href) => workbench?.openLink(href),
    onToggleTask: (line) => workbench?.toggleTask(line)
  })
  const layout = new Layout(byId('workspace'), byId('divider'), prefs, (next) => window.api.setPrefs(next))
  const toolbar = new Toolbar(byId('toolbar'), (command) => run(command))
  const sync = new ScrollSync(editor, preview, () => layout.mode === 'split', prefs.syncScroll)
  const outline = new OutlineView(byId('outline'), (heading) => workbench?.goToHeading(heading))
  const tabHandlers: TabHandlers = {
    onSelect: (id) => workbench?.activate(id),
    onClose: (id) => void workbench?.closeTab(id)
  }
  const tabStrip = new TabStrip(byId('tabs'), tabHandlers)
  const fileList = new FileList(byId('file-list'), byId('file-count'), tabHandlers)
  const findBar = new FindBar(byId('preview'), {
    bar: byId('find-bar'),
    input: byId<HTMLInputElement>('find-input'),
    count: byId('find-count'),
    prev: byId<HTMLButtonElement>('find-prev'),
    next: byId<HTMLButtonElement>('find-next'),
    close: byId<HTMLButtonElement>('find-close')
  })
  const wb = new Workbench({ editor, preview, sync, outline, tabStrip, fileList, status, layout, findBar, toolbar })
  workbench = wb

  toolbar.setMode(layout.mode)
  toolbar.setSync(prefs.syncScroll)
  toolbar.setTheme(theme)
  status.setTheme(theme)

  function toggleTheme(): void {
    theme = nextTheme(theme)
    applyTheme(theme)
    toolbar.setTheme(theme)
    status.setTheme(theme)
    window.api.setTheme(theme)
  }

  /** Formatting only makes sense while the source is visible. */
  const whenEditing = (edit: (state: EditorState) => TransactionSpec) => (): void => {
    if (layout.mode === 'preview') {
      status.showMessage('Switch to Editor or Split view to edit', 'info')
      return
    }
    editor.run(edit(editor.state))
  }

  const commands: Record<MenuCommand, () => void> = {
    new: () => wb.newTab(),
    open: () => void wb.openDialog(),
    save: () => void wb.save(),
    saveAs: () => void wb.saveAs(),
    saveAll: () => void wb.saveAll(),
    closeTab: () => void wb.closeTab(),
    nextTab: () => wb.cycle(1),
    prevTab: () => wb.cycle(-1),
    // Text boxes (find fields) keep their native undo; otherwise use the editor's history.
    undo: () => (focusedTextField() ? document.execCommand('undo') : editor.undo()),
    redo: () => (focusedTextField() ? document.execCommand('redo') : editor.redo()),
    selectAll: () => {
      const field = focusedTextField()
      if (field) field.select()
      else if (layout.mode === 'preview') preview.selectAll()
      else editor.selectAll()
    },
    find: () => (layout.mode === 'preview' ? findBar.show() : editor.openSearch()),
    bold: whenEditing((s) => toggleInline(s, 'bold')),
    italic: whenEditing((s) => toggleInline(s, 'italic')),
    strike: whenEditing((s) => toggleInline(s, 'strike')),
    code: whenEditing((s) => toggleInline(s, 'code')),
    link: whenEditing(insertLink),
    heading1: whenEditing((s) => toggleLineBlock(s, 'heading1')),
    heading2: whenEditing((s) => toggleLineBlock(s, 'heading2')),
    heading3: whenEditing((s) => toggleLineBlock(s, 'heading3')),
    bulletList: whenEditing((s) => toggleLineBlock(s, 'bullet')),
    orderedList: whenEditing((s) => toggleLineBlock(s, 'ordered')),
    taskList: whenEditing((s) => toggleLineBlock(s, 'task')),
    quote: whenEditing((s) => toggleLineBlock(s, 'quote')),
    codeBlock: whenEditing((s) => insertBlock(s, 'codeBlock')),
    table: whenEditing((s) => insertBlock(s, 'table')),
    hr: whenEditing((s) => insertBlock(s, 'hr')),
    viewEditor: () => wb.setMode('editor'),
    viewSplit: () => wb.setMode('split'),
    viewPreview: () => wb.setMode('preview'),
    toggleSync: () => wb.setSync(!layout.current.syncScroll),
    toggleSidebar: () => layout.toggleSidebar(),
    toggleTheme,
    zoomIn: () => wb.setZoom(layout.current.zoom + 0.1),
    zoomOut: () => wb.setZoom(layout.current.zoom - 0.1),
    zoomReset: () => wb.setZoom(1)
  }

  function run(command: MenuCommand): void {
    commands[command]?.()
  }

  window.api.onMenuCommand(run)
  window.api.onLineNumbers((on) => editor.setLineNumbers(on))
  window.api.onOpenPath((path) => void wb.openPath(path))
  window.api.onRequestSaveBeforeClose(async () => {
    if (await wb.saveAll()) window.api.confirmClose()
  })

  byId('status-theme').addEventListener('click', toggleTheme)
  byId('side-new').addEventListener('click', () => run('new'))
  byId('side-open').addEventListener('click', () => run('open'))
  byId('tab-new').addEventListener('click', () => run('new'))
  byId('tabs').addEventListener('dblclick', (event) => {
    if (event.target === event.currentTarget) run('new')
  })

  // Resizing rewraps both panes differently; line them back up afterwards.
  let resizeTimer: ReturnType<typeof setTimeout> | null = null
  window.addEventListener('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => sync.fromEditor(), 150)
  })

  // Drop Markdown files anywhere on the window to open them as tabs.
  window.addEventListener('dragover', (event) => {
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  })
  window.addEventListener('drop', (event) => {
    event.preventDefault()
    const files = [...(event.dataTransfer?.files ?? [])]
    const paths = files.map((f) => window.api.getPathForFile(f)).filter((p) => p !== '' && isMarkdownPath(p))
    if (paths.length > 0) void wb.openPaths(paths)
    else if (files.length > 0) status.showMessage('Only Markdown (.md) and text files can be opened', 'info')
  })

  // Restore the previous session (plus any "open with" file), else show the welcome page.
  if (startup.files.length > 0) wb.openDocuments(startup.files, startup.activePath)
  else wb.newTab(WELCOME)
  if (layout.mode !== 'preview') editor.focus()
}

void init()
