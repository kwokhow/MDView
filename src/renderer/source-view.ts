import { EditorState, Compartment, type Extension } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  highlightSpecialChars
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches, openSearchPanel } from '@codemirror/search'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import type { ThemeName } from '../shared/types'

type ChangeHandler = (text: string) => void
type CursorHandler = (line: number, column: number) => void

function themeExtension(theme: ThemeName): Extension {
  return theme === 'dark' ? oneDark : []
}

function readonlyExtension(readonly: boolean): Extension {
  return [EditorState.readOnly.of(readonly), EditorView.editable.of(!readonly)]
}

/**
 * Raw-Markdown "source mode" surface: a CodeMirror editor with a line-number
 * gutter, Markdown highlighting (including fenced code), search, and history.
 *
 * The WYSIWYG view has no fixed lines — paragraphs reflow to the window — so
 * whole-document line numbers only make sense here. The two surfaces are kept
 * in sync by the caller: text flows in via mount/setText and out via getText.
 */
export class SourceView {
  private view: EditorView | null = null
  private readonly host: HTMLElement
  private readonly themeCompartment = new Compartment()
  private readonly readonlyCompartment = new Compartment()
  private onChange: ChangeHandler = () => {}
  private onCursor: CursorHandler = () => {}
  /** Suppresses change notifications during programmatic document replacement. */
  private silent = false

  constructor(host: HTMLElement) {
    this.host = host
  }

  get isMounted(): boolean {
    return this.view !== null
  }

  setChangeHandler(handler: ChangeHandler): void {
    this.onChange = handler
  }

  setCursorHandler(handler: CursorHandler): void {
    this.onCursor = handler
  }

  /** Create the editor in the host with the given text. Replaces any prior instance. */
  mount(text: string, theme: ThemeName, readonly: boolean): void {
    this.unmount()
    const state = EditorState.create({
      doc: text,
      extensions: this.extensions(theme, readonly)
    })
    this.view = new EditorView({ state, parent: this.host })
    this.emitCursor(this.view.state)
  }

  unmount(): void {
    this.view?.destroy()
    this.view = null
  }

  getText(): string {
    return this.view?.state.doc.toString() ?? ''
  }

  /** Replace the whole document without emitting a change (used on file load). */
  setText(text: string): void {
    const view = this.view
    if (!view) return
    this.silent = true
    try {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } })
    } finally {
      this.silent = false
    }
  }

  setTheme(theme: ThemeName): void {
    this.view?.dispatch({ effects: this.themeCompartment.reconfigure(themeExtension(theme)) })
  }

  setReadonly(readonly: boolean): void {
    this.view?.dispatch({
      effects: this.readonlyCompartment.reconfigure(readonlyExtension(readonly))
    })
  }

  /** Open CodeMirror's own search panel (the WYSIWYG find bar does not apply here). */
  openSearch(): void {
    if (this.view) openSearchPanel(this.view)
  }

  focus(): void {
    this.view?.focus()
  }

  private extensions(theme: ThemeName, readonly: boolean): Extension[] {
    return [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      EditorState.allowMultipleSelections.of(true),
      bracketMatching(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
      markdown({ codeLanguages: languages }),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      EditorView.lineWrapping,
      this.themeCompartment.of(themeExtension(theme)),
      this.readonlyCompartment.of(readonlyExtension(readonly)),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !this.silent) this.onChange(update.state.doc.toString())
        if (update.selectionSet || update.docChanged) this.emitCursor(update.state)
      })
    ]
  }

  private emitCursor(state: EditorState): void {
    const pos = state.selection.main.head
    const line = state.doc.lineAt(pos)
    this.onCursor(line.number, pos - line.from + 1)
  }
}
