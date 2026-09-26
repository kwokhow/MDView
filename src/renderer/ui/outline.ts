import type { Heading } from '../lib/markdown'

/**
 * The document outline in the sidebar: every heading, indented by level.
 * The section currently at the top of the view is highlighted.
 */
export class OutlineView {
  private headings: readonly Heading[] = []
  private signature = ''
  private activeIndex = -1

  constructor(
    private readonly root: HTMLElement,
    private readonly onSelect: (heading: Heading) => void
  ) {
    root.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLElement>('[data-index]')
      const heading = button ? this.headings[Number(button.dataset.index)] : undefined
      if (heading) this.onSelect(heading)
    })
  }

  update(headings: readonly Heading[]): void {
    const signature = headings.map((h) => `${h.level}:${h.line}:${h.text}`).join('\n')
    if (signature === this.signature) {
      this.headings = headings
      return
    }
    this.signature = signature
    this.headings = headings
    this.activeIndex = -1

    if (headings.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'outline-empty'
      empty.textContent = 'No headings in this document'
      this.root.replaceChildren(empty)
      return
    }
    const minLevel = Math.min(...headings.map((h) => h.level))
    const items = headings.map((h, i) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `outline-item lvl-${h.level}`
      button.dataset.index = String(i)
      button.style.setProperty('--depth', String(h.level - minLevel))
      button.textContent = h.text || '(untitled)'
      button.title = h.text
      return button
    })
    this.root.replaceChildren(...items)
  }

  /** Highlight the last heading at or above this 0-based source line. */
  setActiveLine(line: number): void {
    let index = -1
    for (let i = 0; i < this.headings.length && this.headings[i].line <= line + 0.5; i++) index = i
    if (index === this.activeIndex) return
    this.root.querySelector('.outline-item.active')?.classList.remove('active')
    this.activeIndex = index
    const current = index >= 0 ? this.root.querySelector<HTMLElement>(`[data-index="${index}"]`) : null
    current?.classList.add('active')
    current?.scrollIntoView({ block: 'nearest' })
  }
}
