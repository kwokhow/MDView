import { EditorView } from '@codemirror/view'
import { HighlightStyle } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

/**
 * Editor look. Colours are CSS variables defined in styles/app.css, so the
 * light/dark switch needs no editor reconfiguration.
 */
export const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'var(--editor-bg)',
    color: 'var(--fg)',
    fontSize: 'calc(13.5px * var(--content-zoom))'
  },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.7' },
  // Generous bottom padding lets the last lines scroll up to eye level.
  // min-width 0: without it a non-wrapping code line would widen the whole
  // text area, and prose would wrap at the diagram's width, not the pane's.
  '.cm-content': { padding: '18px 0 45vh', caretColor: 'var(--accent)', minWidth: '0' },
  '.cm-line': { padding: '0 24px 0 14px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
    { backgroundColor: 'var(--editor-selection)' },
  '.cm-activeLine': { backgroundColor: 'var(--editor-active-line)' },
  // Code-block lines: no wrapping (keeps diagrams and aligned SQL intact) and
  // a faint code background, mirroring the preview.
  '.cm-line.cm-code-line': {
    whiteSpace: 'pre',
    wordBreak: 'normal',
    overflowWrap: 'normal',
    // Overflow the (pane-width) text area rather than stretch it; the
    // background follows the text when a line is wider than the pane.
    width: 'max-content',
    minWidth: '100%',
    backgroundColor: 'var(--editor-code-bg)'
  },
  '.cm-line.cm-code-line.cm-activeLine': { backgroundColor: 'var(--editor-active-line)' },
  '.cm-gutters': {
    backgroundColor: 'var(--editor-bg)',
    color: 'var(--editor-gutter-fg)',
    border: 'none',
    borderRight: '1px solid var(--border-subtle)'
  },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 16px', minWidth: '34px' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--editor-active-line)', color: 'var(--fg-muted)' },
  '.cm-selectionMatch': { backgroundColor: 'var(--editor-match)' },
  '.cm-searchMatch': { backgroundColor: 'var(--find-all-bg)', outline: '1px solid var(--find-all-border)' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'var(--find-current-bg)' },
  '&.cm-focused .cm-matchingBracket': { backgroundColor: 'var(--editor-match)', outline: 'none' },
  '.cm-panels': { backgroundColor: 'var(--bg-subtle)', color: 'var(--fg)' },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--border)' },
  '.cm-panels.cm-panels-bottom': { borderTop: '1px solid var(--border)' },
  '.cm-panel.cm-search': { padding: '8px 36px 8px 12px', fontFamily: 'var(--font-ui)', fontSize: '12px' },
  '.cm-panel.cm-search label': { fontSize: '12px', color: 'var(--fg-muted)' },
  '.cm-textfield': {
    backgroundColor: 'var(--bg)',
    color: 'var(--fg)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '12px'
  },
  '.cm-textfield:focus': { borderColor: 'var(--accent)', outline: 'none' },
  '.cm-button': {
    backgroundImage: 'none',
    backgroundColor: 'var(--bg)',
    color: 'var(--fg)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '12px'
  },
  '.cm-button:active': { backgroundImage: 'none', backgroundColor: 'var(--bg-muted)' },
  '.cm-panel.cm-search [name=close]': { color: 'var(--fg-muted)', fontSize: '18px', right: '10px', top: '6px' },
  '.cm-tooltip': { backgroundColor: 'var(--bg)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: '6px' }
})

/** Markdown source colouring, plus code-language colours inside fenced blocks. */
export const editorHighlight = HighlightStyle.define([
  { tag: t.heading, fontWeight: '700', color: 'var(--tok-heading)' },
  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, color: 'var(--tok-link)' },
  { tag: t.url, color: 'var(--tok-url)' },
  { tag: t.monospace, color: 'var(--tok-code)' },
  { tag: t.quote, color: 'var(--fg-muted)' },
  { tag: [t.processingInstruction, t.contentSeparator, t.meta], color: 'var(--tok-mark)' },
  { tag: [t.keyword, t.operatorKeyword, t.modifier, t.controlKeyword, t.definitionKeyword, t.operator], color: 'var(--tok-keyword)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--tok-string)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--tok-comment)', fontStyle: 'italic' },
  { tag: [t.number, t.bool, t.null, t.atom, t.propertyName, t.attributeName], color: 'var(--tok-constant)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.className, t.typeName], color: 'var(--tok-function)' },
  { tag: t.tagName, color: 'var(--tok-tag)' },
  { tag: t.invalid, color: 'var(--danger)' }
])
