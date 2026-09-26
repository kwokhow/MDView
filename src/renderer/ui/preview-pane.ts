import { sanitizePreview } from '../lib/sanitize'
import { lineToOffset, normalizeAnchors, offsetToLine, type LineAnchor } from '../lib/scroll-map'

export interface PreviewHandlers {
  onScroll: () => void
  /** A link in the document was clicked (raw href). */
  onLink: (href: string) => void
  /** A task-list checkbox was clicked; the 0-based source line of its item. */
  onToggleTask: (line: number) => void
}

/**
 * The formatted, read-only preview. Every rendered block carries the source
 * line it came from (data-line), which is what makes scroll sync and outline
 * jumps line up with the editor.
 */
export class PreviewPane {
  private anchorCache: LineAnchor[] | null = null
  private anchorLines = -1

  constructor(
    readonly scroller: HTMLElement,
    readonly content: HTMLElement,
    handlers: PreviewHandlers
  ) {
    scroller.addEventListener('scroll', () => handlers.onScroll(), { passive: true })
    content.addEventListener('click', (event) => this.handleClick(event, handlers))
    // Middle-click would otherwise try to open links in a new window.
    content.addEventListener('auxclick', (event) => {
      if ((event.target as Element | null)?.closest('a')) event.preventDefault()
    })
    new ResizeObserver(() => this.invalidate()).observe(content)
  }

  /** Replace the preview with freshly rendered (and sanitized) HTML. */
  render(html: string, baseDir: string | null): void {
    this.content.replaceChildren(sanitizePreview(html, baseDir))
    this.invalidate()
    for (const img of this.content.querySelectorAll('img')) {
      img.addEventListener('load', () => this.invalidate(), { once: true })
    }
  }

  /** Forget measured block positions (after render, resize or image load). */
  invalidate(): void {
    this.anchorCache = null
  }

  get scrollTop(): number {
    return this.scroller.scrollTop
  }

  set scrollTop(value: number) {
    this.scroller.scrollTop = value
  }

  scrollToLine(line: number, totalLines: number): void {
    this.scroller.scrollTop = Math.max(0, lineToOffset(this.anchors(totalLines), line) - this.padTop())
  }

  topVisibleLine(totalLines: number): number {
    return offsetToLine(this.anchors(totalLines), this.scroller.scrollTop + this.padTop())
  }

  /** Scroll a heading (by anchor id) to the top and flash it. False if not found. */
  scrollToHeading(slug: string): boolean {
    const el = this.content.querySelector<HTMLElement>(`[data-heading-id="${CSS.escape(slug)}"]`)
    if (!el) return false
    const top = el.getBoundingClientRect().top - this.scroller.getBoundingClientRect().top + this.scroller.scrollTop
    this.scroller.scrollTop = Math.max(0, top - this.padTop())
    el.classList.remove('flash')
    void el.offsetWidth
    el.classList.add('flash')
    return true
  }

  isAtBottom(): boolean {
    const s = this.scroller
    return s.scrollHeight > s.clientHeight && s.scrollTop + s.clientHeight >= s.scrollHeight - 2
  }

  scrollToBottom(): void {
    this.scroller.scrollTop = this.scroller.scrollHeight
  }

  /** Select the whole preview (Select All while in preview-only mode). */
  selectAll(): void {
    const range = document.createRange()
    range.selectNodeContents(this.content)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }

  private padTop(): number {
    return parseFloat(getComputedStyle(this.content).paddingTop) || 0
  }

  /** Measured top of every source-mapped block, plus an end-of-document sentinel. */
  private anchors(totalLines: number): LineAnchor[] {
    if (this.anchorCache && this.anchorLines === totalLines) return this.anchorCache
    const origin = this.scroller.getBoundingClientRect().top - this.scroller.scrollTop
    const raw: LineAnchor[] = []
    for (const el of this.content.querySelectorAll<HTMLElement>('[data-line]')) {
      const line = Number(el.dataset.line)
      if (!Number.isFinite(line) || el.getClientRects().length === 0) continue
      raw.push({ line, top: el.getBoundingClientRect().top - origin })
    }
    const last = this.content.lastElementChild
    if (last) raw.push({ line: totalLines, top: last.getBoundingClientRect().bottom - origin })
    this.anchorCache = normalizeAnchors(raw)
    this.anchorLines = totalLines
    return this.anchorCache
  }

  private handleClick(event: MouseEvent, handlers: PreviewHandlers): void {
    const target = event.target as Element | null
    const box = target?.closest('input.task-list-item-checkbox')
    if (box) {
      // The preview is read-only: edit the source line and let it re-render.
      event.preventDefault()
      const line = Number(box.closest<HTMLElement>('li[data-line]')?.dataset.line)
      if (Number.isFinite(line)) handlers.onToggleTask(line)
      return
    }
    const link = target?.closest('a[href]')
    if (link) {
      event.preventDefault()
      handlers.onLink(link.getAttribute('href') ?? '')
    }
  }
}
