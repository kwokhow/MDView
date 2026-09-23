import './styles/app.css'
import { MarkdownEditor } from './editor'
import { SourceView } from './source-view'
import { FindController } from './find'
import { applyTheme, nextTheme } from './theme'
import {
  createEmptyDocument,
  resetDocument,
  titleFor,
  withDirty,
  withSavedPath,
  type DocumentState
} from './document'
import type { MenuCommand, ThemeName } from '../shared/types'

const WELCOME = `# Welcome to MDView

*by KEC*

A **live, what-you-see-is-what-you-get** Markdown editor. Type Markdown and it
renders in place — no split-pane preview.

## Try it
- Type \`## \` at the start of a line to make a heading
- Wrap text in \`**stars**\` for **bold**, \`*one*\` for *italic*
- Start a line with \`- [ ] \` for a task:
- [ ] open a file with **Ctrl+O**
- [x] save with **Ctrl+S**

> Blockquotes, \`inline code\`, tables, and fenced code blocks all work.

| Shortcut | Action |
| --- | --- |
| Ctrl+N | New |
| Ctrl+O | Open |
| Ctrl+S | Save |
| Ctrl+F | Find |
| Ctrl+E | Source mode (raw Markdown with line numbers) |
| Ctrl+\\\\ | Toggle theme |

\`\`\`js
function hello(name) {
  return \`Hello, \${name}!\`
}
\`\`\`

Open a \`.md\` file to get started, or just start writing here.
`

// --- App state (held as immutable snapshots, replaced on change) ---
let doc: DocumentState = createEmptyDocument()
let theme: ThemeName = 'light'
let reading = false
let zoom = 1
/** True while the raw-Markdown source surface is the active editor. */
let sourceMode = false
/** Guards against re-entrant toggles while a surface switch is in flight. */
let sourceSwitching = false

let editor!: MarkdownEditor
let source!: SourceView
let find!: FindController

const el = {
  host: document.getElementById('editor-host') as HTMLElement,
  sourceHost: document.getElementById('source-host') as HTMLElement,
  name: document.getElementById('status-name') as HTMLElement,
  mode: document.getElementById('status-mode') as HTMLElement,
  cursor: document.getElementById('status-cursor') as HTMLElement,
  words: document.getElementById('status-words') as HTMLElement,
  chars: document.getElementById('status-chars') as HTMLElement,
  themeLabel: document.getElementById('status-theme') as HTMLElement
}

// --- UI sync helpers ---
function renderStatus(markdown: string): void {
  const words = (markdown.match(/\S+/g) || []).length
  el.words.textContent = `${words} ${words === 1 ? 'word' : 'words'}`
  el.chars.textContent = `${markdown.length} ${markdown.length === 1 ? 'character' : 'characters'}`
}

function renderCursor(line: number, column: number): void {
  el.cursor.textContent = `Ln ${line}, Col ${column}`
}

function syncDocUi(): void {
  document.title = `${titleFor(doc)} — MDView`
  el.name.textContent = titleFor(doc)
}

function setDoc(next: DocumentState): void {
  const wasDirty = doc.dirty
  doc = next
  syncDocUi()
  if (next.dirty !== wasDirty) window.api.setDirty(next.dirty)
}

/** Markdown from whichever surface the user is currently editing. */
function currentMarkdown(): string {
  return sourceMode && source.isMounted ? source.getText() : editor.getMarkdown()
}

// --- Dirty tracking (debounced refresh of find while open) ---
let findTimer: ReturnType<typeof setTimeout> | null = null
function onEditorChange(markdown: string): void {
  renderStatus(markdown)
  if (!doc.dirty) setDoc(withDirty(doc, true))
  if (find.isOpen) {
    if (findTimer) clearTimeout(findTimer)
    findTimer = setTimeout(() => find.refresh(), 200)
  }
}

function onSourceChange(text: string): void {
  renderStatus(text)
  if (!doc.dirty) setDoc(withDirty(doc, true))
}

// --- File operations ---
function confirmDiscardIfDirty(): boolean {
  if (!doc.dirty) return true
  return window.confirm('You have unsaved changes. Discard them?')
}

/** Push new content into every active surface. */
async function setContent(markdown: string): Promise<void> {
  await editor.load(markdown)
  if (source.isMounted) source.setText(markdown)
}

async function loadFromDisk(path: string, content: string): Promise<void> {
  await setContent(content)
  const name = path.split(/[\\/]/).pop() || 'Untitled'
  setDoc(withSavedPath(doc, path, name))
  renderStatus(content)
  window.api.addRecent(path)
  focusActive()
}

async function newFile(): Promise<void> {
  if (!confirmDiscardIfDirty()) return
  await setContent('')
  setDoc(resetDocument())
  renderStatus('')
  focusActive()
}

async function openFile(): Promise<void> {
  if (!confirmDiscardIfDirty()) return
  const opened = await window.api.openFileDialog()
  if (!opened) return
  await loadFromDisk(opened.path, opened.content)
}

/** Save; returns true if the document is now persisted, false if cancelled. */
async function save(): Promise<boolean> {
  const markdown = currentMarkdown()
  if (doc.path) {
    await window.api.saveFile(doc.path, markdown)
    setDoc(withDirty(doc, false))
    return true
  }
  return saveAs()
}

async function saveAs(): Promise<boolean> {
  const markdown = currentMarkdown()
  const suggested = doc.name.endsWith('.md') ? doc.name : `${doc.name}.md`
  const result = await window.api.saveFileAs(markdown, suggested)
  if (!result) return false
  const name = result.path.split(/[\\/]/).pop() || 'Untitled'
  setDoc(withSavedPath(doc, result.path, name))
  return true
}

// --- View commands ---
function focusActive(): void {
  if (sourceMode) source.focus()
  else editor.focus()
}

function toggleTheme(): void {
  theme = nextTheme(theme)
  applyTheme(theme)
  el.themeLabel.textContent = theme === 'dark' ? 'Dark' : 'Light'
  if (source.isMounted) source.setTheme(theme)
  window.api.setTheme(theme)
}

function toggleReading(): void {
  reading = !reading
  editor.setReadonly(reading)
  if (source.isMounted) source.setReadonly(reading)
  document.body.classList.toggle('reading', reading)
}

/**
 * Switch between the live WYSIWYG surface and the raw-Markdown source surface.
 * Text flows WYSIWYG → source on entry, and source → WYSIWYG on exit so edits
 * made in either view are never lost.
 */
async function toggleSource(): Promise<void> {
  if (sourceSwitching) return
  sourceSwitching = true
  try {
    if (!sourceMode) {
      // Handlers must be attached before mount: mount emits the initial cursor
      // position, which would otherwise hit the no-op default handler.
      source.setChangeHandler(onSourceChange)
      source.setCursorHandler(renderCursor)
      source.mount(editor.getMarkdown(), theme, reading)
      sourceMode = true
      document.body.classList.add('source-mode')
      el.host.classList.add('hidden')
      el.sourceHost.classList.remove('hidden')
      el.mode.textContent = 'Source'
      source.focus()
    } else {
      const markdown = source.getText()
      document.body.classList.remove('source-mode')
      el.sourceHost.classList.add('hidden')
      el.host.classList.remove('hidden')
      el.mode.textContent = ''
      el.cursor.textContent = ''
      // editor.load() destroys and recreates the live view, which takes real
      // time on a large document. sourceMode stays true until the live view
      // holds the source text, so a Save (or save-before-close) that lands
      // mid-swap still reads the mounted source view via currentMarkdown()
      // instead of a half-rebuilt editor's stale fallback.
      await editor.load(markdown)
      sourceMode = false
      source.unmount()
      editor.focus()
    }
  } finally {
    sourceSwitching = false
  }
}

function applyLineNumbers(enabled: boolean): void {
  document.body.classList.toggle('no-line-numbers', !enabled)
}

function applyZoom(): void {
  document.documentElement.style.setProperty('--app-zoom', String(zoom))
}
function zoomIn(): void {
  zoom = Math.min(2.2, zoom + 0.1)
  applyZoom()
}
function zoomOut(): void {
  zoom = Math.max(0.6, zoom - 0.1)
  applyZoom()
}
function zoomReset(): void {
  zoom = 1
  applyZoom()
}

// --- Command dispatch from menu/shortcuts ---
const commands: Record<MenuCommand, () => void> = {
  new: () => void newFile(),
  open: () => void openFile(),
  save: () => void save(),
  saveAs: () => void saveAs(),
  // The WYSIWYG find bar walks ProseMirror text nodes; in source mode use
  // CodeMirror's own search panel, which understands its virtualized document.
  find: () => (sourceMode ? source.openSearch() : find.show()),
  toggleTheme,
  toggleReading,
  toggleSource: () => void toggleSource(),
  zoomIn,
  zoomOut,
  zoomReset
}

// --- Bootstrap ---
async function init(): Promise<void> {
  // A settings failure must never block the editor from mounting.
  try {
    theme = await window.api.getTheme()
  } catch {
    theme = 'light'
  }
  applyTheme(theme)
  el.themeLabel.textContent = theme === 'dark' ? 'Dark' : 'Light'

  let lineNumbersOn = true
  try {
    lineNumbersOn = await window.api.getLineNumbers()
  } catch {
    lineNumbersOn = true
  }
  applyLineNumbers(lineNumbersOn)

  // Resolve the startup file BEFORE mounting so the editor is created exactly
  // once with the correct content. This avoids a mount-welcome-then-reload
  // churn, which previously could race the editor's destroy/recreate and leak
  // the editor's stylesheet into the document as text.
  let startup: { path: string; content: string } | null = null
  try {
    startup = await window.api.getStartupFile()
  } catch {
    startup = null
  }

  const initialContent = startup ? startup.content : WELCOME
  editor = await MarkdownEditor.mount(el.host, initialContent)
  editor.setChangeHandler(onEditorChange)
  renderStatus(initialContent)

  if (startup) {
    const name = startup.path.split(/[\\/]/).pop() || 'Untitled'
    setDoc(withSavedPath(doc, startup.path, name))
  } else {
    // Mounting with the welcome content marks no dirty state.
    setDoc(createEmptyDocument())
  }

  source = new SourceView(el.sourceHost)

  find = new FindController(el.host, {
    bar: document.getElementById('find-bar') as HTMLElement,
    input: document.getElementById('find-input') as HTMLInputElement,
    count: document.getElementById('find-count') as HTMLElement,
    prev: document.getElementById('find-prev') as HTMLButtonElement,
    next: document.getElementById('find-next') as HTMLButtonElement,
    close: document.getElementById('find-close') as HTMLButtonElement
  })

  // Wire IPC from main.
  window.api.onMenuCommand((command) => commands[command]?.())
  window.api.onLineNumbers((enabled) => applyLineNumbers(enabled))
  window.api.onOpenPath(async (path) => {
    if (!confirmDiscardIfDirty()) return
    const opened = await window.api.readFile(path)
    await loadFromDisk(opened.path, opened.content)
  })
  window.api.onRequestSaveBeforeClose(async () => {
    const ok = await save()
    if (ok) window.api.confirmClose()
  })

  // Clickable theme label in the status bar.
  el.themeLabel.addEventListener('click', toggleTheme)

  // In-renderer accelerator safety net for find focus. In source mode the
  // keystroke is left to CodeMirror's own search keymap.
  window.addEventListener('keydown', (e) => {
    if (sourceMode) return
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault()
      find.show()
    }
  })

  editor.focus()
}

void init()
