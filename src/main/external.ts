import { shell } from 'electron'

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

/**
 * Open a link in the system browser — only for web and mail links.
 *
 * The preview renders arbitrary document content, so a link could point at a
 * local executable or a custom protocol handler. Everything except
 * http(s)/mailto is refused.
 */
export function openExternalSafe(url: unknown): void {
  if (typeof url !== 'string') return
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return
  void shell.openExternal(parsed.toString())
}
