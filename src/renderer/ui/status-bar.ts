import type { DocStats } from '../lib/stats'
import type { ThemeName } from '../../shared/types'

export interface StatusElements {
  path: HTMLElement
  saved: HTMLElement
  message: HTMLElement
  cursor: HTMLElement
  stats: HTMLElement
  theme: HTMLElement
}

export interface DocumentStatus {
  path: string | null
  dirty: boolean
  savedAt: Date | null
}

const number = new Intl.NumberFormat()
const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })

/** The bar along the bottom: path, save state, cursor, counts, theme. */
export class StatusBar {
  private messageTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly el: StatusElements) {}

  setDocument(doc: DocumentStatus): void {
    this.el.path.textContent = doc.path ?? 'Unsaved document'
    this.el.path.title = doc.path ?? ''
    this.el.saved.classList.toggle('dirty', doc.dirty)
    this.el.saved.textContent = doc.dirty ? 'Unsaved changes' : doc.savedAt ? `Saved ${time.format(doc.savedAt)}` : ''
  }

  setStats(stats: DocStats): void {
    const parts = [
      `${number.format(stats.words)} words`,
      `${number.format(stats.chars)} chars`,
      `${number.format(stats.lines)} lines`
    ]
    if (stats.readingMinutes > 0) parts.push(`${stats.readingMinutes} min read`)
    this.el.stats.textContent = parts.join(' · ')
  }

  setCursor(line: number, column: number): void {
    this.el.cursor.textContent = `Ln ${line}, Col ${column}`
  }

  setTheme(theme: ThemeName): void {
    this.el.theme.textContent = theme === 'dark' ? 'Dark' : 'Light'
  }

  /** Show a short-lived message (errors in red, info in accent colour). */
  showMessage(text: string, kind: 'error' | 'info' = 'error'): void {
    this.el.message.textContent = text
    this.el.message.className = `status-message ${kind}`
    if (this.messageTimer) clearTimeout(this.messageTimer)
    this.messageTimer = setTimeout(() => {
      this.el.message.textContent = ''
    }, 6000)
  }
}
