import MarkdownIt from 'markdown-it'
import type { StateCore, Token } from 'markdown-it'
import hljs from 'highlight.js/lib/common'

/** A heading in the document, for the outline and for "#section" links. */
export interface Heading {
  readonly level: number
  readonly text: string
  /** 0-based source line of the heading. */
  readonly line: number
  /** GitHub-style anchor id ("my-heading", "my-heading-1" for repeats). */
  readonly slug: string
}

export interface RenderResult {
  readonly html: string
  readonly headings: readonly Heading[]
}

const TASK_MARKER = /^\[([ xX])\][ \t]/

const md = new MarkdownIt({ html: true, linkify: true, typographer: false })

/** "Heading Text — here!" → "heading-text--here", as GitHub builds anchor ids. */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-')
}

function highlight(code: string, lang: string): string {
  if (lang && hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
    } catch {
      // Fall through to plain escaped text.
    }
  }
  return md.utils.escapeHtml(code)
}

/** Fenced code: highlighted, and tagged with its source line for scroll sync. */
function renderFence(tokens: Token[], idx: number): string {
  const token = tokens[idx]
  const lang = token.info.trim().split(/\s+/)[0] ?? ''
  const line = token.attrGet('data-line')
  const lineAttr = line !== null ? ` data-line="${line}"` : ''
  const safeLang = md.utils.escapeHtml(lang)
  const langAttrs = lang ? ` data-lang="${safeLang}"` : ''
  const codeClass = lang ? `hljs language-${safeLang}` : 'hljs'
  return `<pre class="code-block"${lineAttr}${langAttrs}><code class="${codeClass}">${highlight(token.content, lang)}</code></pre>\n`
}

/**
 * GitHub task lists: "- [ ] item" / "- [x] item" render with a checkbox. The
 * preview is read-only, so ticking one is routed back to edit the source line.
 */
function taskLists(state: StateCore): void {
  const tokens = state.tokens
  for (let i = 2; i < tokens.length; i++) {
    const inline = tokens[i]
    if (inline.type !== 'inline' || tokens[i - 1].type !== 'paragraph_open') continue
    if (tokens[i - 2].type !== 'list_item_open') continue
    const first = inline.children?.[0]
    const match = first?.type === 'text' ? TASK_MARKER.exec(first.content) : null
    if (!first || !match || !inline.children) continue

    first.content = first.content.slice(match[0].length)
    const box = new state.Token('html_inline', '', 0)
    box.content = `<input type="checkbox" class="task-list-item-checkbox"${match[1] === ' ' ? '' : ' checked'}> `
    inline.children.unshift(box)

    const item = tokens[i - 2]
    item.attrJoin('class', 'task-list-item')
    for (let j = i - 3; j >= 0; j--) {
      const t = tokens[j]
      if (t.level === item.level - 1 && (t.type === 'bullet_list_open' || t.type === 'ordered_list_open')) {
        // Every task item in the list reaches here; mark the list only once.
        if (!String(t.attrGet('class') ?? '').split(' ').includes('contains-task-list')) {
          t.attrJoin('class', 'contains-task-list')
        }
        break
      }
    }
  }
}

md.core.ruler.push('mdview_task_lists', taskLists)
md.renderer.rules.fence = renderFence
// Wrap tables so a table wider than the pane scrolls on its own instead of
// pushing the page sideways.
md.renderer.rules.table_open = (tokens, idx, options, _env, self) =>
  `<div class="table-wrap">${self.renderToken(tokens, idx, options)}`
md.renderer.rules.table_close = (tokens, idx, options, _env, self) =>
  `${self.renderToken(tokens, idx, options)}</div>`

/** Tag every block with its 0-based source line so the panes can scroll together. */
function annotateSourceLines(tokens: Token[]): void {
  for (const t of tokens) {
    if (t.map && t.block && t.nesting !== -1 && t.type !== 'inline') {
      t.attrSet('data-line', String(t.map[0]))
    }
  }
}

function plainText(inline: Token | undefined): string {
  if (!inline || inline.type !== 'inline' || !inline.children) return ''
  return inline.children
    .map((c) => {
      if (c.type === 'text' || c.type === 'code_inline') return c.content
      if (c.type === 'softbreak' || c.type === 'hardbreak') return ' '
      if (c.type === 'image') return c.content
      return ''
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Collect headings and give each a unique anchor id. */
function annotateHeadings(tokens: Token[]): Heading[] {
  const used = new Map<string, number>()
  const headings: Heading[] = []
  tokens.forEach((t, i) => {
    if (t.type !== 'heading_open') return
    const text = plainText(tokens[i + 1])
    const base = slugify(text) || 'section'
    const seen = used.get(base) ?? 0
    used.set(base, seen + 1)
    const slug = seen === 0 ? base : `${base}-${seen}`
    // A data attribute rather than id: the sanitizer strips ids that collide
    // with DOM properties (a heading called "Title" would lose id="title").
    t.attrSet('data-heading-id', slug)
    headings.push({ level: Number(t.tag.slice(1)), text, line: t.map ? t.map[0] : 0, slug })
  })
  return headings
}

/** Render Markdown to (unsanitized) HTML plus the heading outline. */
export function renderMarkdown(source: string): RenderResult {
  const env = {}
  const tokens = md.parse(source, env)
  annotateSourceLines(tokens)
  const headings = annotateHeadings(tokens)
  return { html: md.renderer.render(tokens, md.options, env), headings }
}
