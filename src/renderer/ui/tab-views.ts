import { FileText, X } from 'lucide'
import { icon } from './icons'

/** What the tab strip and the sidebar file list need to draw one document. */
export interface TabItem {
  readonly id: string
  readonly name: string
  /** Parent folder, shown only when two open files share a name. */
  readonly hint: string
  /** Tooltip: the full path, or "Unsaved document". */
  readonly title: string
  readonly dirty: boolean
  readonly active: boolean
}

export interface TabHandlers {
  onSelect: (id: string) => void
  onClose: (id: string) => void
}

function closeButton(item: TabItem, className: string): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = className
  button.dataset.close = item.id
  button.title = item.dirty ? 'Unsaved changes — close (Ctrl+W)' : 'Close (Ctrl+W)'
  button.setAttribute('aria-label', `Close ${item.name}`)
  button.append(icon(X, 14))
  return button
}

function label(item: TabItem, prefix: string): HTMLSpanElement {
  const wrap = document.createElement('span')
  wrap.className = `${prefix}-label`
  const name = document.createElement('span')
  name.className = `${prefix}-name`
  name.textContent = item.name
  wrap.append(name)
  if (item.hint) {
    const hint = document.createElement('span')
    hint.className = `${prefix}-hint`
    hint.textContent = item.hint
    wrap.append(hint)
  }
  return wrap
}

/** Click selects, the close button (or middle-click) closes. */
function bind(root: HTMLElement, itemSelector: string, handlers: TabHandlers): void {
  root.addEventListener('click', (event) => {
    const target = event.target as Element
    const close = target.closest<HTMLElement>('[data-close]')
    if (close?.dataset.close) {
      event.stopPropagation()
      handlers.onClose(close.dataset.close)
      return
    }
    const item = target.closest<HTMLElement>(itemSelector)
    if (item?.dataset.id) handlers.onSelect(item.dataset.id)
  })
  root.addEventListener('mousedown', (event) => {
    if (event.button === 1) event.preventDefault()
  })
  root.addEventListener('auxclick', (event) => {
    const item = (event.target as Element).closest<HTMLElement>(itemSelector)
    if (event.button === 1 && item?.dataset.id) handlers.onClose(item.dataset.id)
  })
}

/** The row of document tabs above the panes. */
export class TabStrip {
  constructor(
    private readonly root: HTMLElement,
    handlers: TabHandlers
  ) {
    bind(root, '.tab', handlers)
  }

  update(items: readonly TabItem[]): void {
    const tabs = items.map((item) => {
      const tab = document.createElement('div')
      tab.className = `tab${item.active ? ' active' : ''}${item.dirty ? ' dirty' : ''}`
      tab.setAttribute('role', 'tab')
      tab.setAttribute('aria-selected', String(item.active))
      tab.dataset.id = item.id
      tab.title = item.title
      tab.append(label(item, 'tab'), closeButton(item, 'tab-close'))
      return tab
    })
    this.root.replaceChildren(...tabs)
    this.root.querySelector('.tab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
}

/** The "Open files" list in the sidebar. */
export class FileList {
  constructor(
    private readonly root: HTMLElement,
    private readonly counter: HTMLElement,
    handlers: TabHandlers
  ) {
    bind(root, '.file-item', handlers)
  }

  update(items: readonly TabItem[]): void {
    const rows = items.map((item) => {
      const row = document.createElement('li')
      row.className = `file-item${item.active ? ' active' : ''}${item.dirty ? ' dirty' : ''}`
      row.dataset.id = item.id
      row.title = item.title
      row.append(icon(FileText, 15), label(item, 'file'), closeButton(item, 'file-close'))
      return row
    })
    this.root.replaceChildren(...rows)
    this.counter.textContent = String(items.length)
  }
}
