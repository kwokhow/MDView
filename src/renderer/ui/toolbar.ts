import {
  ArrowDownUp,
  Bold,
  Code,
  Columns2,
  Eye,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Moon,
  PanelLeft,
  PenLine,
  Redo2,
  SquareCode,
  Strikethrough,
  Sun,
  Table,
  TextQuote,
  Undo2
} from 'lucide'
import type { MenuCommand, ThemeName, ViewMode } from '../../shared/types'
import { icon, type IconNode } from './icons'

interface ButtonSpec {
  readonly command: MenuCommand
  readonly icon: IconNode
  readonly label: string
  readonly shortcut?: string
}

/** Editing buttons, in groups. Disabled in preview-only mode (no editor visible). */
const EDIT_GROUPS: readonly (readonly ButtonSpec[])[] = [
  [
    { command: 'undo', icon: Undo2, label: 'Undo', shortcut: 'Ctrl+Z' },
    { command: 'redo', icon: Redo2, label: 'Redo', shortcut: 'Ctrl+Y' }
  ],
  [
    { command: 'bold', icon: Bold, label: 'Bold', shortcut: 'Ctrl+B' },
    { command: 'italic', icon: Italic, label: 'Italic', shortcut: 'Ctrl+I' },
    { command: 'strike', icon: Strikethrough, label: 'Strikethrough', shortcut: 'Ctrl+Shift+X' },
    { command: 'code', icon: Code, label: 'Inline code', shortcut: 'Ctrl+E' },
    { command: 'link', icon: Link, label: 'Link', shortcut: 'Ctrl+K' }
  ],
  [
    { command: 'heading1', icon: Heading1, label: 'Heading 1', shortcut: 'Ctrl+1' },
    { command: 'heading2', icon: Heading2, label: 'Heading 2', shortcut: 'Ctrl+2' },
    { command: 'heading3', icon: Heading3, label: 'Heading 3', shortcut: 'Ctrl+3' }
  ],
  [
    { command: 'bulletList', icon: List, label: 'Bulleted list' },
    { command: 'orderedList', icon: ListOrdered, label: 'Numbered list' },
    { command: 'taskList', icon: ListChecks, label: 'Task list' },
    { command: 'quote', icon: TextQuote, label: 'Quote' }
  ],
  [
    { command: 'codeBlock', icon: SquareCode, label: 'Code block' },
    { command: 'table', icon: Table, label: 'Table' },
    { command: 'hr', icon: Minus, label: 'Horizontal rule' }
  ]
]

const VIEW_BUTTONS: readonly { mode: ViewMode; command: MenuCommand; icon: IconNode; label: string; shortcut: string }[] = [
  { mode: 'editor', command: 'viewEditor', icon: PenLine, label: 'Editor', shortcut: 'Ctrl+Alt+1' },
  { mode: 'split', command: 'viewSplit', icon: Columns2, label: 'Split', shortcut: 'Ctrl+Alt+2' },
  { mode: 'preview', command: 'viewPreview', icon: Eye, label: 'Preview', shortcut: 'Ctrl+Alt+3' }
]

function tooltip(label: string, shortcut?: string): string {
  return shortcut ? `${label} (${shortcut})` : label
}

function button(className: string, command: MenuCommand, title: string, content: Node[]): HTMLButtonElement {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = className
  el.dataset.command = command
  el.title = title
  el.setAttribute('aria-label', title)
  el.append(...content)
  return el
}

function textSpan(text: string): HTMLSpanElement {
  const span = document.createElement('span')
  span.textContent = text
  return span
}

/** The formatting and view toolbar above the panes. */
export class Toolbar {
  private readonly editButtons: HTMLButtonElement[] = []
  private readonly viewButtons = new Map<ViewMode, HTMLButtonElement>()
  private readonly syncButton: HTMLButtonElement
  private readonly themeButton: HTMLButtonElement

  constructor(root: HTMLElement, dispatch: (command: MenuCommand) => void) {
    const lead = document.createElement('div')
    lead.className = 'tb-group'
    lead.append(button('tb-btn', 'toggleSidebar', tooltip('Toggle sidebar', 'Ctrl+Alt+B'), [icon(PanelLeft)]))

    // Formatting buttons scroll when the window is narrow; view controls never do.
    const edit = document.createElement('div')
    edit.className = 'tb-edit'
    for (const group of EDIT_GROUPS) {
      const el = document.createElement('div')
      el.className = 'tb-group'
      for (const spec of group) {
        const b = button('tb-btn', spec.command, tooltip(spec.label, spec.shortcut), [icon(spec.icon)])
        this.editButtons.push(b)
        el.append(b)
      }
      edit.append(el)
    }
    edit.addEventListener(
      'wheel',
      (event) => {
        if (event.deltaY === 0) return
        edit.scrollLeft += event.deltaY
        event.preventDefault()
      },
      { passive: false }
    )

    const segmented = document.createElement('div')
    segmented.className = 'segmented'
    segmented.setAttribute('role', 'radiogroup')
    segmented.setAttribute('aria-label', 'View')
    for (const view of VIEW_BUTTONS) {
      const b = button('seg-btn', view.command, tooltip(`${view.label} view`, view.shortcut), [icon(view.icon, 15), textSpan(view.label)])
      b.setAttribute('role', 'radio')
      this.viewButtons.set(view.mode, b)
      segmented.append(b)
    }

    this.syncButton = button('tb-toggle', 'toggleSync', 'Scroll the editor and preview together', [
      icon(ArrowDownUp, 15),
      textSpan('Sync')
    ])
    this.themeButton = button('tb-btn', 'toggleTheme', tooltip('Toggle light / dark theme', 'Ctrl+\\'), [])
    const view = document.createElement('div')
    view.className = 'tb-view'
    view.append(segmented, this.syncButton, this.themeButton)

    root.append(lead, edit, view)

    root.addEventListener('click', (event) => {
      const el = (event.target as Element).closest<HTMLButtonElement>('button[data-command]')
      if (el && !el.disabled) dispatch(el.dataset.command as MenuCommand)
    })
    // Keep focus in the editor when clicking toolbar buttons.
    root.addEventListener('mousedown', (event) => {
      if ((event.target as Element).closest('button')) event.preventDefault()
    })
  }

  setMode(mode: ViewMode): void {
    for (const [m, b] of this.viewButtons) {
      b.classList.toggle('active', m === mode)
      b.setAttribute('aria-checked', String(m === mode))
    }
    for (const b of this.editButtons) b.disabled = mode === 'preview'
    this.syncButton.disabled = mode !== 'split'
  }

  setSync(on: boolean): void {
    this.syncButton.classList.toggle('on', on)
    this.syncButton.setAttribute('aria-pressed', String(on))
  }

  setTheme(theme: ThemeName): void {
    this.themeButton.replaceChildren(icon(theme === 'dark' ? Sun : Moon))
  }
}
