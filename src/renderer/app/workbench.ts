import type { EditorState } from '@codemirror/state'
import type { OpenedFile, ViewMode } from '../../shared/types'
import { renderMarkdown, slugify, type Heading } from '../lib/markdown'
import { basename, classifyLink, dirname } from '../lib/paths'
import { computeStats } from '../lib/stats'
import { toggleTaskAtLine } from '../lib/format'
import * as tabs from '../lib/tabs'
import type { Tab, TabList } from '../lib/tabs'
import type { EditorPane } from '../ui/editor-pane'
import type { PreviewPane } from '../ui/preview-pane'
import type { ScrollSync } from '../ui/scroll-sync'
import type { OutlineView } from '../ui/outline'
import type { FileList, TabItem, TabStrip } from '../ui/tab-views'
import type { StatusBar } from '../ui/status-bar'
import type { Layout } from '../ui/layout'
import type { FindBar } from '../ui/find-bar'
import type { Toolbar } from '../ui/toolbar'

export interface WorkbenchParts {
  editor: EditorPane
  preview: PreviewPane
  sync: ScrollSync
  outline: OutlineView
  tabStrip: TabStrip
  fileList: FileList
  status: StatusBar
  layout: Layout
  findBar: FindBar
  toolbar: Toolbar
}

/** Typing is re-rendered into the preview after this pause. */
const RENDER_DELAY_MS = 120

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Coordinates the open documents: tabs, opening/saving/closing, rendering the
 * preview and outline, links, and keeping the chrome (tabs, title, status,
 * session, unsaved flag) in step with the tab list.
 */
export class Workbench {
  private list: TabList = tabs.EMPTY_TABS
  private seq = 0
  private headings: readonly Heading[] = []
  private renderTimer: ReturnType<typeof setTimeout> | null = null
  private previewStale = true
  private outlineFrame = 0
  private readonly savedAt = new Map<string, Date>()
  private reportedDirty = false
  private reportedSession = ''

  constructor(private readonly p: WorkbenchParts) {}

  private get activeTab(): Tab | null {
    return tabs.getActive(this.list)
  }

  // ---------------------------------------------------------------- opening

  newTab(content = ''): void {
    this.stashActive()
    this.list = tabs.addTab(this.list, this.makeTab(null, content, this.list))
    this.showActive()
    if (this.p.layout.mode !== 'preview') this.p.editor.focus()
  }

  /**
   * Open files as tabs (focusing any already open). A lone untouched untitled
   * tab, such as the welcome page, is replaced rather than left behind.
   */
  openDocuments(files: readonly OpenedFile[], activatePath: string | null = null): void {
    if (files.length === 0) return
    this.stashActive()
    const lone = this.list.tabs.length === 1 && tabs.isDisposable(this.list.tabs[0]) ? this.list.tabs[0] : null
    let list = this.list
    let focusId: string | null = null
    for (const file of files) {
      const existing = tabs.findByPath(list, file.path)
      if (existing) {
        // Re-opening an unchanged tab picks up edits made outside MDView.
        if (!tabs.isDirty(existing) && existing.state.doc.toString() !== file.content) {
          const state = this.p.editor.createState(file.content)
          list = tabs.updateTab(list, existing.id, { state, savedDoc: state.doc })
        }
        focusId = existing.id
      } else {
        const tab = this.makeTab(file.path, file.content, list)
        list = tabs.addTab(list, tab)
        focusId = tab.id
      }
    }
    const preferred = activatePath ? tabs.findByPath(list, activatePath) : undefined
    if (preferred) focusId = preferred.id
    if (lone && list.tabs.length > 1) list = tabs.removeTab(list, lone.id)
    this.list = focusId ? tabs.setActive(list, focusId) : list
    this.showActive()
  }

  async openDialog(): Promise<void> {
    try {
      this.openDocuments(await window.api.openFileDialog())
    } catch (error) {
      this.p.status.showMessage(`Could not open: ${errorText(error)}`)
    }
  }

  async openPaths(paths: readonly string[]): Promise<void> {
    const results = await Promise.allSettled(paths.map((p) => window.api.readFile(p)))
    const files = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
    if (files.length < results.length) {
      this.p.status.showMessage(`${results.length - files.length} file(s) could not be opened`)
    }
    this.openDocuments(files)
  }

  /** Open (or focus) one file, optionally jumping to a heading anchor. */
  async openPath(path: string, anchor: string | null = null): Promise<void> {
    const existing = tabs.findByPath(this.list, path)
    if (existing) {
      this.activate(existing.id)
    } else {
      try {
        this.openDocuments([await window.api.readFile(path)])
      } catch (error) {
        this.p.status.showMessage(`Could not open ${basename(path)}: ${errorText(error)}`)
        return
      }
    }
    if (anchor) requestAnimationFrame(() => this.goToAnchor(anchor))
  }

  // -------------------------------------------------------------- switching

  activate(id: string): void {
    if (id === this.list.activeId) return
    this.stashActive()
    this.list = tabs.setActive(this.list, id)
    this.showActive()
  }

  cycle(delta: 1 | -1): void {
    const id = tabs.neighborId(this.list, delta)
    if (id) this.activate(id)
  }

  // ----------------------------------------------------------------- saving

  async save(id: string | null = this.list.activeId): Promise<boolean> {
    const tab = id ? tabs.getTab(this.list, id) : undefined
    if (!tab) return false
    if (!tab.path) return this.saveAs(tab.id)
    const doc = tab.state.doc
    try {
      await window.api.saveFile(tab.path, doc.toString())
    } catch (error) {
      this.p.status.showMessage(`Could not save ${tabs.tabName(tab)}: ${errorText(error)}`)
      return false
    }
    this.markSaved(tab.id, { savedDoc: doc })
    return true
  }

  async saveAs(id: string | null = this.list.activeId): Promise<boolean> {
    const tab = id ? tabs.getTab(this.list, id) : undefined
    if (!tab) return false
    const doc = tab.state.doc
    const suggested = tab.path ? basename(tab.path) : `${tabs.tabName(tab)}.md`
    let saved: { path: string } | null
    try {
      saved = await window.api.saveFileAs(doc.toString(), suggested)
    } catch (error) {
      this.p.status.showMessage(`Could not save ${tabs.tabName(tab)}: ${errorText(error)}`)
      return false
    }
    if (!saved) return false

    // Another tab may be showing the file just overwritten: close it if it is
    // unchanged, or keep its unsaved edits as an untitled document.
    const activeBefore = this.list.activeId
    const { list, detachedId } = tabs.resolvePathClash(this.list, tab.id, saved.path)
    this.list = list
    const detached = detachedId ? tabs.getTab(this.list, detachedId) : undefined
    if (detached) {
      this.p.status.showMessage(
        `${basename(saved.path)} was overwritten — your unsaved edits to it are kept in "${tabs.tabName(detached)}"`,
        'info'
      )
    }
    this.markSaved(tab.id, { path: saved.path, savedDoc: doc })
    // The folder changed (relative images), or the active tab changed.
    if (this.list.activeId !== activeBefore) this.showActive()
    else if (tab.id === this.list.activeId) this.renderNow()
    return true
  }

  /** Save every unsaved tab; false if any save failed or was cancelled. */
  async saveAll(): Promise<boolean> {
    for (const id of this.list.tabs.map((t) => t.id)) {
      const tab = tabs.getTab(this.list, id)
      if (!tab || !tabs.isDirty(tab)) continue
      // Show an untitled document before asking where to save it.
      if (!tab.path) this.activate(tab.id)
      if (!(await this.save(tab.id))) return false
    }
    return true
  }

  private markSaved(id: string, patch: Partial<Omit<Tab, 'id'>>): void {
    this.list = tabs.updateTab(this.list, id, patch)
    this.savedAt.set(id, new Date())
    this.syncChrome()
  }

  // ---------------------------------------------------------------- closing

  /** Close a tab, asking to save unsaved changes. False if the user cancelled. */
  async closeTab(id: string | null = this.list.activeId): Promise<boolean> {
    const tab = id ? tabs.getTab(this.list, id) : undefined
    if (!tab) return false
    if (tabs.isDirty(tab)) {
      this.activate(tab.id)
      const choice = await window.api.askSaveChanges(tabs.tabName(tab))
      if (choice === 'cancel') return false
      if (choice === 'save' && !(await this.save(tab.id))) return false
    }
    const wasActive = tab.id === this.list.activeId
    this.list = tabs.removeTab(this.list, tab.id)
    this.savedAt.delete(tab.id)
    if (this.list.tabs.length === 0) this.newTab()
    else if (wasActive) this.showActive()
    else this.syncChrome()
    return true
  }

  // ------------------------------------------------------ editing & preview

  /** The editor changed the active document. */
  onDocChange(state: EditorState): void {
    const active = this.activeTab
    if (!active) return
    const wasDirty = tabs.isDirty(active)
    this.list = tabs.updateTab(this.list, active.id, { state })
    if (tabs.isDirty({ ...active, state }) !== wasDirty) this.syncChrome()
    this.scheduleRender()
  }

  /** A task checkbox was ticked in the preview: flip it in the source. */
  toggleTask(line: number): void {
    const spec = toggleTaskAtLine(this.p.editor.state, line)
    if (spec) this.p.editor.run(spec, false)
  }

  onEditorScroll(): void {
    this.p.sync.onEditorScroll()
    if (this.p.layout.mode !== 'preview') this.trackOutline(() => this.p.editor.topVisibleLine())
  }

  onPreviewScroll(): void {
    this.p.sync.onPreviewScroll()
    if (this.p.layout.mode === 'preview') {
      this.trackOutline(() => this.p.preview.topVisibleLine(this.p.editor.lineCount))
    }
  }

  // ------------------------------------------------------- links & headings

  openLink(href: string): void {
    const tab = this.activeTab
    const target = classifyLink(href, tab?.path ? dirname(tab.path) : null)
    if (target.kind === 'external') window.api.openExternal(target.url)
    else if (target.kind === 'anchor') this.goToAnchor(target.id)
    else if (target.kind === 'file') void this.openPath(target.path, target.anchor)
    else this.p.status.showMessage(`This link can't be opened from the preview: ${href}`, 'info')
  }

  goToAnchor(id: string): void {
    const heading =
      this.headings.find((h) => h.slug === id.toLowerCase()) ?? this.headings.find((h) => h.slug === slugify(id))
    if (heading) this.goToHeading(heading)
    else this.p.status.showMessage(`No heading "#${id}" in this document`, 'info')
  }

  goToHeading(heading: Heading): void {
    const { editor, preview, layout, outline } = this.p
    if (layout.mode !== 'preview') editor.revealLine(heading.line, true)
    if (layout.mode !== 'editor') requestAnimationFrame(() => preview.scrollToHeading(heading.slug))
    outline.setActiveLine(heading.line)
  }

  // ------------------------------------------------------------------ view

  setMode(mode: ViewMode): void {
    const { layout, editor, preview, sync, toolbar, findBar } = this.p
    const from = layout.mode
    if (from === mode) return
    const line = from === 'preview' ? preview.topVisibleLine(editor.lineCount) : editor.topVisibleLine()
    layout.setMode(mode)
    toolbar.setMode(mode)
    if (mode !== 'preview') findBar.hide()
    if (mode !== 'editor' && this.previewStale) this.renderNow()
    requestAnimationFrame(() => {
      if (mode === 'preview') preview.scrollToLine(line, editor.lineCount)
      else if (from === 'preview') editor.scrollToLine(line)
      if (mode === 'split') sync.fromEditor()
      if (mode !== 'preview') editor.focus()
    })
  }

  setSync(on: boolean): void {
    this.p.layout.setSync(on)
    this.p.sync.setEnabled(on)
    this.p.toolbar.setSync(on)
  }

  setZoom(zoom: number): void {
    this.p.layout.setZoom(zoom)
    this.p.editor.remeasure()
    this.p.preview.invalidate()
  }

  // --------------------------------------------------------------- internals

  private makeTab(path: string | null, content: string, list: TabList): Tab {
    const state = this.p.editor.createState(content)
    return {
      id: `tab-${++this.seq}`,
      path,
      untitledIndex: path ? 0 : tabs.nextUntitledIndex(list),
      state,
      savedDoc: state.doc,
      editorScroll: 0,
      previewScroll: 0
    }
  }

  /** Save the active tab's editor state and scroll positions before switching away. */
  private stashActive(): void {
    const active = this.activeTab
    if (!active) return
    const { editor, preview, layout } = this.p
    const topLine = layout.mode === 'preview' ? preview.topVisibleLine(editor.lineCount) : editor.topVisibleLine()
    this.list = tabs.updateTab(this.list, active.id, {
      state: editor.state,
      editorScroll: topLine,
      ...(layout.mode !== 'editor' ? { previewScroll: preview.scrollTop } : {})
    })
  }

  private showActive(): void {
    const tab = this.activeTab
    if (!tab) return
    if (this.p.editor.state !== tab.state) this.p.editor.setState(tab.state)
    this.p.findBar.hide()
    this.renderNow()
    this.syncChrome()
    const { editorScroll, previewScroll } = tab
    requestAnimationFrame(() => this.restoreScroll(editorScroll, previewScroll))
  }

  private restoreScroll(line: number, previewTop: number): void {
    const { editor, preview, layout, sync } = this.p
    if (layout.mode === 'preview') {
      preview.scrollToLine(line, editor.lineCount)
      return
    }
    editor.revealLine(line, false)
    if (layout.mode === 'split' && sync.isEnabled) requestAnimationFrame(() => sync.fromEditor())
    else preview.scrollTop = previewTop
  }

  private scheduleRender(): void {
    if (this.renderTimer) clearTimeout(this.renderTimer)
    this.renderTimer = setTimeout(() => this.renderNow(), RENDER_DELAY_MS)
  }

  /** Re-render the preview, outline and counts from the active tab's text. */
  private renderNow(): void {
    if (this.renderTimer) clearTimeout(this.renderTimer)
    this.renderTimer = null
    const tab = this.activeTab
    if (!tab) return
    const text = tab.state.doc.toString()
    const { html, headings } = renderMarkdown(text)
    this.headings = headings
    this.p.outline.update(headings)
    this.p.status.setStats(computeStats(text))
    if (this.p.layout.mode === 'editor') {
      this.previewStale = true
      return
    }
    this.p.preview.render(html, tab.path ? dirname(tab.path) : null)
    this.previewStale = false
    this.p.findBar.refresh()
    requestAnimationFrame(() => this.p.sync.fromEditor())
  }

  private trackOutline(line: () => number): void {
    cancelAnimationFrame(this.outlineFrame)
    this.outlineFrame = requestAnimationFrame(() => this.p.outline.setActiveLine(line()))
  }

  /** Bring tabs, file list, title, status, session and the unsaved flag up to date. */
  private syncChrome(): void {
    const { tabStrip, fileList, status } = this.p
    const hints = tabs.duplicateHints(this.list)
    const items: TabItem[] = this.list.tabs.map((t) => ({
      id: t.id,
      name: tabs.tabName(t),
      hint: hints.get(t.id) ?? '',
      title: t.path ?? 'Unsaved document',
      dirty: tabs.isDirty(t),
      active: t.id === this.list.activeId
    }))
    tabStrip.update(items)
    fileList.update(items)

    const active = this.activeTab
    const dirty = active ? tabs.isDirty(active) : false
    document.title = active ? `${dirty ? '● ' : ''}${tabs.tabName(active)} — MDView` : 'MDView'
    status.setDocument({
      path: active?.path ?? null,
      dirty,
      savedAt: active ? (this.savedAt.get(active.id) ?? null) : null
    })

    const anyDirty = tabs.hasDirty(this.list)
    if (anyDirty !== this.reportedDirty) {
      this.reportedDirty = anyDirty
      window.api.setDirty(anyDirty)
    }
    const session = tabs.sessionOf(this.list)
    const key = JSON.stringify(session)
    if (key !== this.reportedSession) {
      this.reportedSession = key
      window.api.setSession(session)
    }
  }
}
