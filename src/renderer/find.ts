/**
 * In-document find using the CSS Custom Highlight API. This highlights text
 * ranges WITHOUT mutating the DOM, which is essential inside a ProseMirror
 * editable area — wrapping match nodes in <span> would corrupt ProseMirror's
 * view reconciliation. Electron's Chromium supports CSS.highlights natively.
 */
const HL_ALL = 'mdview-find'
const HL_CURRENT = 'mdview-find-current'

interface FindElements {
  bar: HTMLElement
  input: HTMLInputElement
  count: HTMLElement
  prev: HTMLButtonElement
  next: HTMLButtonElement
  close: HTMLButtonElement
}

export class FindController {
  private readonly host: HTMLElement
  private readonly el: FindElements
  private ranges: Range[] = []
  private active = -1
  private readonly supported = typeof CSS !== 'undefined' && 'highlights' in CSS

  constructor(host: HTMLElement, el: FindElements) {
    this.host = host
    this.el = el
    this.bindEvents()
  }

  private bindEvents(): void {
    this.el.input.addEventListener('input', () => this.search(this.el.input.value))
    this.el.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (e.shiftKey) this.go(-1)
        else this.go(1)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        this.hide()
      }
    })
    this.el.next.addEventListener('click', () => this.go(1))
    this.el.prev.addEventListener('click', () => this.go(-1))
    this.el.close.addEventListener('click', () => this.hide())
  }

  get isOpen(): boolean {
    return !this.el.bar.classList.contains('hidden')
  }

  /** Show the find bar, prefilling with any current selection. */
  show(): void {
    const selection = window.getSelection()?.toString().trim()
    if (selection) this.el.input.value = selection
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

  /** Recompute matches; called on edits while the bar is open. */
  refresh(): void {
    if (this.isOpen && this.el.input.value) this.search(this.el.input.value)
  }

  private search(query: string): void {
    this.clearHighlights()
    this.ranges = []
    this.active = -1

    const q = query.trim()
    if (q.length === 0) {
      this.updateCount()
      return
    }

    const editable = this.host.querySelector<HTMLElement>('.ProseMirror') ?? this.host
    const needle = q.toLowerCase()
    const walker = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode() as Text | null
    while (node) {
      const text = node.nodeValue ?? ''
      const hay = text.toLowerCase()
      let from = 0
      let idx = hay.indexOf(needle, from)
      while (idx !== -1) {
        const range = document.createRange()
        range.setStart(node, idx)
        range.setEnd(node, idx + needle.length)
        this.ranges.push(range)
        from = idx + needle.length
        idx = hay.indexOf(needle, from)
      }
      node = walker.nextNode() as Text | null
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
    const highlights = (CSS as unknown as { highlights: Map<string, unknown> }).highlights
    const all = this.ranges.filter((_, i) => i !== this.active)
    const HighlightCtor = (window as unknown as { Highlight: new (...r: Range[]) => unknown })
      .Highlight
    highlights.set(HL_ALL, new HighlightCtor(...all))
    if (this.active >= 0) {
      highlights.set(HL_CURRENT, new HighlightCtor(this.ranges[this.active]))
    }
  }

  private clearHighlights(): void {
    if (!this.supported) return
    const highlights = (CSS as unknown as { highlights: Map<string, unknown> }).highlights
    highlights.delete(HL_ALL)
    highlights.delete(HL_CURRENT)
  }

  private scrollToActive(): void {
    const range = this.ranges[this.active]
    if (!range) return
    const target =
      range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement
        : (range.startContainer as HTMLElement)
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  private updateCount(): void {
    const total = this.ranges.length
    const current = total === 0 ? 0 : this.active + 1
    this.el.count.textContent = `${current}/${total}`
  }
}
