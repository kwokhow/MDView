/**
 * Find in the formatted preview (preview-only mode). Matches are painted with
 * the CSS Custom Highlight API, so the rendered DOM is never modified. In the
 * editor, CodeMirror's own search panel is used instead.
 */
const HL_ALL = 'mdview-find'
const HL_CURRENT = 'mdview-find-current'

export interface FindElements {
  bar: HTMLElement
  input: HTMLInputElement
  count: HTMLElement
  prev: HTMLButtonElement
  next: HTMLButtonElement
  close: HTMLButtonElement
}

export class FindBar {
  private ranges: Range[] = []
  private active = -1
  private readonly supported = typeof CSS !== 'undefined' && 'highlights' in CSS

  constructor(
    private readonly host: HTMLElement,
    private readonly el: FindElements
  ) {
    el.input.addEventListener('input', () => this.search(el.input.value))
    el.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        this.go(e.shiftKey ? -1 : 1)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        this.hide()
      }
    })
    el.next.addEventListener('click', () => this.go(1))
    el.prev.addEventListener('click', () => this.go(-1))
    el.close.addEventListener('click', () => this.hide())
  }

  get isOpen(): boolean {
    return !this.el.bar.classList.contains('hidden')
  }

  /** Show the bar, prefilled with the current selection if any. */
  show(): void {
    const selection = window.getSelection()?.toString().trim()
    if (selection && !selection.includes('\n')) this.el.input.value = selection
    this.el.bar.classList.remove('hidden')
    this.el.input.focus()
    this.el.input.select()
    if (this.el.input.value) this.search(this.el.input.value)
  }

  hide(): void {
    this.el.bar.classList.add('hidden')
    this.clearHighlights()
    this.ranges = []
    this.active = -1
    this.updateCount()
  }

  /** Re-run the search after the preview re-rendered. */
  refresh(): void {
    if (this.isOpen && this.el.input.value) this.search(this.el.input.value)
  }

  private search(query: string): void {
    this.clearHighlights()
    this.ranges = []
    this.active = -1
    const needle = query.trim().toLowerCase()
    if (needle) {
      const walker = document.createTreeWalker(this.host, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
        const hay = (node.nodeValue ?? '').toLowerCase()
        for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + needle.length)) {
          const range = document.createRange()
          range.setStart(node, at)
          range.setEnd(node, at + needle.length)
          this.ranges.push(range)
        }
      }
    }
    if (this.ranges.length > 0) {
      this.active = 0
      this.paint()
      this.scrollToActive()
    }
    this.updateCount()
  }

  private go(direction: 1 | -1): void {
    if (this.ranges.length === 0) return
    this.active = (this.active + direction + this.ranges.length) % this.ranges.length
    this.paint()
    this.scrollToActive()
    this.updateCount()
  }

  private paint(): void {
    if (!this.supported) return
    CSS.highlights.set(HL_ALL, new Highlight(...this.ranges.filter((_, i) => i !== this.active)))
    if (this.active >= 0) CSS.highlights.set(HL_CURRENT, new Highlight(this.ranges[this.active]))
  }

  private clearHighlights(): void {
    if (!this.supported) return
    CSS.highlights.delete(HL_ALL)
    CSS.highlights.delete(HL_CURRENT)
  }

  private scrollToActive(): void {
    const range = this.ranges[this.active]
    const target = range?.startContainer.parentElement
    target?.scrollIntoView({ block: 'center' })
  }

  private updateCount(): void {
    const total = this.ranges.length
    this.el.count.textContent = `${total === 0 ? 0 : this.active + 1}/${total}`
  }
}
