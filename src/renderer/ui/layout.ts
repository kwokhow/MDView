import type { ViewMode, ViewPrefs } from '../../shared/types'

const MIN_SPLIT = 0.15
const MAX_SPLIT = 0.85

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Pane arrangement: Editor / Split / Preview, the draggable divider, the
 * sidebar and the text zoom. Holds the ViewPrefs and reports every change so
 * the caller can persist it.
 */
export class Layout {
  private prefs: ViewPrefs

  constructor(
    private readonly workspace: HTMLElement,
    private readonly divider: HTMLElement,
    initial: ViewPrefs,
    private readonly onChange: (prefs: ViewPrefs) => void
  ) {
    this.prefs = initial
    this.apply()
    this.bindDivider()
  }

  get current(): ViewPrefs {
    return this.prefs
  }

  get mode(): ViewMode {
    return this.prefs.mode
  }

  setMode(mode: ViewMode): void {
    this.update({ mode })
  }

  setSync(syncScroll: boolean): void {
    this.update({ syncScroll })
  }

  toggleSidebar(): void {
    this.update({ sidebar: !this.prefs.sidebar })
  }

  setZoom(zoom: number): void {
    this.update({ zoom: Math.round(clamp(zoom, 0.7, 2) * 10) / 10 })
  }

  private update(patch: Partial<ViewPrefs>, persist = true): void {
    this.prefs = { ...this.prefs, ...patch }
    this.apply()
    if (persist) this.onChange(this.prefs)
  }

  private apply(): void {
    document.body.dataset.mode = this.prefs.mode
    document.body.classList.toggle('no-sidebar', !this.prefs.sidebar)
    this.workspace.style.setProperty('--split', `${(this.prefs.splitRatio * 100).toFixed(2)}%`)
    document.documentElement.style.setProperty('--content-zoom', String(this.prefs.zoom))
  }

  /** Drag the divider to resize the panes; double-click resets to 50/50. */
  private bindDivider(): void {
    const onMove = (event: PointerEvent): void => {
      const rect = this.workspace.getBoundingClientRect()
      const ratio = clamp((event.clientX - rect.left) / rect.width, MIN_SPLIT, MAX_SPLIT)
      this.update({ splitRatio: ratio }, false)
    }
    const onUp = (event: PointerEvent): void => {
      this.divider.releasePointerCapture(event.pointerId)
      this.divider.removeEventListener('pointermove', onMove)
      this.divider.removeEventListener('pointerup', onUp)
      this.divider.classList.remove('dragging')
      document.body.classList.remove('resizing')
      this.onChange(this.prefs)
    }
    this.divider.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return
      event.preventDefault()
      this.divider.setPointerCapture(event.pointerId)
      this.divider.classList.add('dragging')
      document.body.classList.add('resizing')
      this.divider.addEventListener('pointermove', onMove)
      this.divider.addEventListener('pointerup', onUp)
    })
    this.divider.addEventListener('dblclick', () => this.update({ splitRatio: 0.5 }))
  }
}
