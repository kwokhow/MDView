import DOMPurify from 'dompurify'
import { resolveAssetSrc } from './paths'

/**
 * Which URLs survive sanitizing. DOMPurify's default list drops file: URLs,
 * which a desktop viewer needs for images stored next to the document.
 * Unlisted schemes such as javascript: are still removed.
 */
const ALLOWED_URI = /^(?:(?:https?|mailto|tel|file|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i

/** The only inline style Markdown produces: column alignment in tables. */
const SAFE_STYLE = /^\s*text-align\s*:\s*(left|right|center|justify)\s*;?\s*$/i

// Any other inline style could load a resource through CSS url(), bypassing
// the checks applied to src attributes below.
DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
  if (data.attrName === 'style' && !SAFE_STYLE.test(data.attrValue)) data.keepAttr = false
})

/**
 * Turn rendered Markdown HTML into a safe DOM fragment. Documents may contain
 * raw HTML, so scripts, event handlers, <style> blocks (which could restyle the
 * whole app) and SVG/MathML are stripped, along with media and every attribute
 * that fetches a resource except `src`. Each `src` is then resolved against the
 * document's folder, and dropped if it points at another network host.
 */
export function sanitizePreview(html: string, baseDir: string | null): DocumentFragment {
  const fragment = DOMPurify.sanitize(html, {
    RETURN_DOM_FRAGMENT: true,
    USE_PROFILES: { html: true },
    ALLOWED_URI_REGEXP: ALLOWED_URI,
    FORBID_TAGS: [
      'style',
      'link',
      'meta',
      'base',
      'form',
      'iframe',
      'frame',
      'frameset',
      'object',
      'embed',
      'video',
      'audio',
      'source',
      'track',
      'picture'
    ],
    FORBID_ATTR: ['srcset', 'background', 'poster', 'ping', 'action', 'formaction']
  })
  for (const el of fragment.querySelectorAll('[src]')) {
    const src = resolveAssetSrc(el.getAttribute('src') ?? '', baseDir)
    if (src === '') el.removeAttribute('src')
    else el.setAttribute('src', src)
    if (el.tagName === 'IMG') el.setAttribute('loading', 'lazy')
  }
  return fragment
}
