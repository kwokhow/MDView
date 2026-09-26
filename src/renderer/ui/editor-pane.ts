import { Compartment, EditorState, type Extension, type TransactionSpec } from '@codemirror/state'
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab, redo, selectAll, undo } from '@codemirror/commands'
import { highlightSelectionMatches, openSearchPanel, search, searchKeymap } from '@codemirror/search'
import { bracketMatching, syntaxHighlighting } from '@codemirror/language'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { editorHighlight, editorTheme } from './editor-theme'
import { codeBlockLines } from './code-lines'

export interface EditorHandlers {
  /** The active document's text changed (not fired for setState). */
  onDocChange: (state: EditorState) => void
  onCursor: (line: number, column: number) => void
  onScroll: () => void
}

function gutter(show: boolean): Extension {
  return show ? [lineNumbers(), highlightActiveLineGutter()] : []
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * The raw-Markdown editor (CodeMirror 6). One view is shared by all tabs;
 * each tab owns an EditorState, swapped in with setState, so switching tabs
 * keeps each document's cursor and undo history.
 */
export class EditorPane {
  readonly view: EditorView
  private readonly gutterSlot = new Compartment()
  private showLineNumbers = true

  constructor(
    parent: HTMLElement,
    private readonly handlers: EditorHandlers
  ) {
    this.view = new EditorView({ parent, state: this.createState('') })
    this.view.scrollDOM.addEventListener('scroll', () => this.handlers.onScroll(), { passive: true })
  }

  /** A fresh state for a new tab, configured like every other tab. */
  createState(text: string): EditorState {
    return EditorState.create({ doc: text, extensions: this.extensions() })
  }

  get state(): EditorState {
    return this.view.state
  }

  get lineCount(): number {
    return this.view.state.doc.lines
  }

  /** Show a tab's state, applying the current line-number preference to it. */
  setState(state: EditorState): void {
    this.view.setState(state)
    this.view.dispatch({ effects: this.gutterSlot.reconfigure(gutter(this.showLineNumbers)) })
    this.emitCursor(this.view.state)
  }

  setLineNumbers(show: boolean): void {
    this.showLineNumbers = show
    this.view.dispatch({ effects: this.gutterSlot.reconfigure(gutter(show)) })
  }

  /** Apply a formatting transaction and return focus to the editor. */
  run(spec: TransactionSpec, focus = true): void {
    this.view.dispatch(spec)
    if (focus) this.view.focus()
  }

  undo(): void {
    undo(this.view)
  }

  redo(): void {
    redo(this.view)
  }

  selectAll(): void {
    selectAll(this.view)
    this.view.focus()
  }

  openSearch(): void {
    openSearchPanel(this.view)
  }

  focus(): void {
    this.view.focus()
  }

  get hasFocus(): boolean {
    return this.view.hasFocus
  }

  /** Re-measure after the text size (zoom) changes. */
  remeasure(): void {
    this.view.requestMeasure()
  }

  /** Fractional 0-based source line at the top edge of the viewport. */
  topVisibleLine(): number {
    const height = this.view.scrollDOM.getBoundingClientRect().top - this.view.documentTop
    if (height <= 0) return 0
    const block = this.view.lineBlockAtHeight(height)
    const line = this.view.state.doc.lineAt(block.from).number - 1
    const fraction = block.height > 0 ? (height - block.top) / block.height : 0
    return line + clamp(fraction, 0, 1)
  }

  /** Scroll so the given fractional 0-based line sits at the top (used for sync). */
  scrollToLine(line: number): void {
    const doc = this.view.state.doc
    const whole = Math.floor(Math.max(0, line))
    const docLine = doc.line(clamp(whole + 1, 1, doc.lines))
    const block = this.view.lineBlockAt(docLine.from)
    const scroller = this.view.scrollDOM
    const documentOffset = this.view.documentTop - scroller.getBoundingClientRect().top + scroller.scrollTop
    scroller.scrollTop = documentOffset + block.top + (line - whole) * block.height
  }

  /** Jump to a line precisely (outline, restoring a tab), optionally moving the cursor there. */
  revealLine(line: number, moveCursor: boolean): void {
    const doc = this.view.state.doc
    const pos = doc.line(clamp(Math.floor(line) + 1, 1, doc.lines)).from
    this.view.dispatch({
      selection: moveCursor ? { anchor: pos } : undefined,
      effects: EditorView.scrollIntoView(pos, { y: 'start', yMargin: 6 })
    })
  }

  isAtBottom(): boolean {
    const s = this.view.scrollDOM
    return s.scrollHeight > s.clientHeight && s.scrollTop + s.clientHeight >= s.scrollHeight - 2
  }

  scrollToBottom(): void {
    const s = this.view.scrollDOM
    s.scrollTop = s.scrollHeight
  }

  private emitCursor(state: EditorState): void {
    const head = state.selection.main.head
    const line = state.doc.lineAt(head)
    this.handlers.onCursor(line.number, head - line.from + 1)
  }

  private extensions(): Extension[] {
    return [
      this.gutterSlot.of(gutter(this.showLineNumbers)),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      bracketMatching(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      search({ top: true }),
      keymap.of([...defaultKeymap, ...searchKeymap, ...historyKeymap, indentWithTab]),
      // GFM (tables, task lists, strikethrough) plus highlighting for fenced code.
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      syntaxHighlighting(editorHighlight),
      EditorView.lineWrapping,
      codeBlockLines,
      EditorView.contentAttributes.of({ spellcheck: 'true', autocorrect: 'off', autocapitalize: 'off' }),
      editorTheme,
      EditorView.domEventHandlers({
        // Dropped files open as tabs (handled at window level); don't paste their text.
        drop: (event) => (event.dataTransfer?.files.length ?? 0) > 0
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) this.handlers.onDocChange(update.state)
        if (update.docChanged || update.selectionSet) this.emitCursor(update.state)
      })
    ]
  }
}
