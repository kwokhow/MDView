import type { EditorPane } from './editor-pane'
import type { PreviewPane } from './preview-pane'

type Side = 'editor' | 'preview'

const USER_INPUT_EVENTS = ['wheel', 'pointerdown', 'keydown', 'touchstart'] as const

/**
 * Keeps the editor and preview scrolled to the same part of the document.
 *
 * Only the pane the user last touched (wheel, click, key, scrollbar) drives
 * the other. The follower's own scroll events are then ignored, which rules
 * out the feedback loop where each pane keeps nudging the other.
 */
export class ScrollSync {
  private driver: Side = 'editor'
  private frame = 0

  constructor(
    private readonly editor: EditorPane,
    private readonly preview: PreviewPane,
    private readonly isSplit: () => boolean,
    private enabled: boolean
  ) {
    for (const type of USER_INPUT_EVENTS) {
      editor.view.dom.addEventListener(type, () => (this.driver = 'editor'), { passive: true, capture: true })
      preview.scroller.addEventListener(type, () => (this.driver = 'preview'), { passive: true, capture: true })
    }
  }

  get isEnabled(): boolean {
    return this.enabled
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (enabled) this.fromEditor()
  }

  onEditorScroll(): void {
    if (this.active() && this.driver === 'editor') this.schedule(() => this.fromEditor())
  }

  onPreviewScroll(): void {
    if (this.active() && this.driver === 'preview') this.schedule(() => this.fromPreview())
  }

  /** Align the preview to the editor now (after a re-render or tab switch). */
  fromEditor(): void {
    if (!this.active()) return
    if (this.editor.isAtBottom()) this.preview.scrollToBottom()
    else this.preview.scrollToLine(this.editor.topVisibleLine(), this.editor.lineCount)
  }

  private fromPreview(): void {
    if (!this.active()) return
    if (this.preview.isAtBottom()) this.editor.scrollToBottom()
    else this.editor.scrollToLine(this.preview.topVisibleLine(this.editor.lineCount))
  }

  private active(): boolean {
    return this.enabled && this.isSplit()
  }

  private schedule(fn: () => void): void {
    cancelAnimationFrame(this.frame)
    this.frame = requestAnimationFrame(fn)
  }
}
