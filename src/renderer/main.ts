import './styles/app.css'
import { MarkdownEditor } from './editor'
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

let editor!: MarkdownEditor
let find!: FindController

const el = {
  host: document.getElementById('editor-host') as HTMLElement,
  name: document.getElementById('status-name') as HTMLElement,
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

// --- File operations ---
function confirmDiscardIfDirty(): boolean {
  if (!doc.dirty) return true
  return window.confirm('You have unsaved changes. Discard them?')
}

async function loadFromDisk(path: string, content: string): Promise<void> {
  await editor.load(content)
  const name = path.split(/[\\/]/).pop() || 'Untitled'
  setDoc(withSavedPath(doc, path, name))
  renderStatus(content)
  window.api.addRecent(path)
  editor.focus()
}

async function newFile(): Promise<void> {
  if (!confirmDiscardIfDirty()) return
  await editor.load('')
  setDoc(resetDocument())
  renderStatus('')
  editor.focus()
}

async function openFile(): Promise<void> {
  if (!confirmDiscardIfDirty()) return
  const opened = await window.api.openFileDialog()
  if (!opened) return
  await loadFromDisk(opened.path, opened.content)
}

/** Save; returns true if the document is now persisted, false if cancelled. */
async function save(): Promise<boolean> {
  const markdown = editor.getMarkdown()
  if (doc.path) {
    await window.api.saveFile(doc.path, markdown)
    setDoc(withDirty(doc, false))
    return true
  }
  return saveAs()
}

async function saveAs(): Promise<boolean> {
  const markdown = editor.getMarkdown()
  const suggested = doc.name.endsWith('.md') ? doc.name : `${doc.name}.md`
  const result = await window.api.saveFileAs(markdown, suggested)
  if (!result) return false
  const name = result.path.split(/[\\/]/).pop() || 'Untitled'
  setDoc(withSavedPath(doc, result.path, name))
  return true
}

// --- View commands ---
function toggleTheme(): void {
  theme = nextTheme(theme)
  applyTheme(theme)
  el.themeLabel.textContent = theme === 'dark' ? 'Dark' : 'Light'
  window.api.setTheme(theme)
}

function toggleReading(): void {
  reading = !reading
  editor.setReadonly(reading)
  document.body.classList.toggle('reading', reading)
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
  find: () => find.show(),
  toggleTheme,
  toggleReading,
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

  editor = await MarkdownEditor.mount(el.host, WELCOME)
  editor.setChangeHandler(onEditorChange)
  renderStatus(WELCOME)
  // Mounting with default content marks no dirty state.
  setDoc(createEmptyDocument())

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

  // In-renderer accelerator safety net for find focus.
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault()
      find.show()
    }
  })

  editor.focus()
}

void init()
