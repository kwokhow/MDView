import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view'

const CODE_NODES = new Set(['FencedCode', 'CodeBlock'])
const codeLine = Decoration.line({ class: 'cm-code-line' })

/**
 * Tag every line of every fenced or indented code block in the whole document.
 *
 * Deliberately not limited to the visible ranges: these lines stop wrapping,
 * so they change height. If they were only tagged once scrolled into view,
 * a jump (outline click, link, tab restore) would land, then the code lines
 * above the target would shrink and shift it off the top of the pane.
 */
function build(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const { doc } = view.state
  let lastLine = 0
  syntaxTree(view.state).iterate({
    enter: (node) => {
      if (!CODE_NODES.has(node.name)) return undefined
      const first = doc.lineAt(node.from).number
      const last = doc.lineAt(node.to).number
      for (let n = Math.max(first, lastLine + 1); n <= last; n++) {
        builder.add(doc.line(n).from, doc.line(n).from, codeLine)
        lastLine = n
      }
      return false
    }
  })
  return builder.finish()
}

/**
 * Prose in the editor wraps to the pane, but code-block lines keep their
 * exact shape (box diagrams, aligned SQL) and scroll sideways instead. The
 * styling lives in editor-theme.ts under `.cm-code-line`.
 */
export const codeBlockLines = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = build(view)
    }

    update(update: ViewUpdate): void {
      // Rebuild on edits and as the background parser reaches further into the
      // document — never merely because the view scrolled.
      if (update.docChanged || syntaxTree(update.startState) !== syntaxTree(update.state)) {
        this.decorations = build(update.view)
      }
    }
  },
  { decorations: (plugin) => plugin.decorations }
)
