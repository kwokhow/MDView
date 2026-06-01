import { Crepe } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'

/**
 * Thin wrapper around Milkdown Crepe.
 *
 * Loading a document recreates the editor with the new content as its default
 * value. This guarantees a clean undo history and document state on every open,
 * and avoids edge cases in incremental replace APIs. Opening a file is not a
 * hot path, so the recreate cost is irrelevant.
 */
export class MarkdownEditor {
  private crepe: Crepe
  private readonly host: HTMLElement
  private onChange: (markdown: string) => void = () => {}
  /** Latest markdown seen from change events — used as a safe fallback. */
  private lastMarkdown = ''

  private constructor(host: HTMLElement, crepe: Crepe, initial: string) {
    this.host = host
    this.crepe = crepe
    this.lastMarkdown = initial
  }

  /** Create and mount an editor in `host` with the given initial markdown. */
  static async mount(host: HTMLElement, initial = ''): Promise<MarkdownEditor> {
    const crepe = new Crepe({ root: host, defaultValue: initial })
    await crepe.create()
    const editor = new MarkdownEditor(host, crepe, initial)
    editor.wireEvents()
    return editor
  }

  private wireEvents(): void {
    this.crepe.on((api) => {
      api.markdownUpdated((ctx, markdown: string) => {
        void ctx
        this.lastMarkdown = markdown
        this.onChange(markdown)
      })
    })
  }

  /** Register a single change handler (replaces any previous). */
  setChangeHandler(handler: (markdown: string) => void): void {
    this.onChange = handler
  }

  /**
   * Current markdown. Guards the known Crepe crash where serialization throws
   * on a fenced code block with no language by falling back to the last value
   * observed from change events.
   */
  getMarkdown(): string {
    try {
      const md = this.crepe.getMarkdown()
      this.lastMarkdown = md
      return md
    } catch {
      return this.lastMarkdown
    }
  }

  /** Replace the entire document by recreating the editor. */
  async load(markdown: string): Promise<void> {
    await this.crepe.destroy()
    this.host.replaceChildren()
    this.crepe = new Crepe({ root: this.host, defaultValue: markdown })
    await this.crepe.create()
    this.lastMarkdown = markdown
    this.wireEvents()
  }

  /** Toggle read-only (reading) mode. */
  setReadonly(value: boolean): void {
    this.crepe.setReadonly(value)
  }

  /** Move keyboard focus into the editor. */
  focus(): void {
    const editable = this.host.querySelector<HTMLElement>('.ProseMirror')
    editable?.focus()
  }
}
