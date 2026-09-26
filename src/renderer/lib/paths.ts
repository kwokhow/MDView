/**
 * Path and link helpers for the renderer, which has no Node `path` module.
 * Windows ("C:\a\b") and POSIX ("/a/b") separators are both accepted.
 */

const WIN_DRIVE = /^[a-zA-Z]:[\\/]/
const MARKDOWN_EXT = /\.(md|markdown|mdown|mkd|mkdn|txt)$/i
const WEB_SCHEMES = new Set(['http', 'https', 'mailto'])

export function isAbsolutePath(p: string): boolean {
  return WIN_DRIVE.test(p) || p.startsWith('\\\\') || p.startsWith('/')
}

/** True for "http:", "mailto:" etc. — but not a Windows drive letter like "C:\". */
export function hasScheme(href: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href) && !WIN_DRIVE.test(href)
}

export function basename(p: string): string {
  const parts = p.split(/[\\/]/)
  return parts[parts.length - 1] || p
}

export function dirname(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return i >= 0 ? p.slice(0, i) : ''
}

export function isMarkdownPath(p: string): boolean {
  return MARKDOWN_EXT.test(p)
}

/** Identity key for a path: Windows paths are case- and separator-insensitive. */
export function pathKey(p: string): string {
  return p.replace(/\//g, '\\').toLowerCase()
}

export function samePath(a: string, b: string): boolean {
  return pathKey(a) === pathKey(b)
}

/** "\\host\share" (or "//host/share") at the start of a network path. */
const UNC_ROOT = /^[\\/]{2}([^\\/]+)[\\/]+([^\\/]+)/

function segments(p: string): string[] {
  return p.split(/[\\/]/).filter((s) => s !== '')
}

/** Split off the part of a path ".." can never climb above: "C:", "\\host\share" or "/". */
function splitRoot(p: string, sep: string): { root: string; parts: string[] } {
  const unc = UNC_ROOT.exec(p)
  if (unc) return { root: `${sep}${sep}${unc[1]}${sep}${unc[2]}`, parts: segments(p.slice(unc[0].length)) }
  const drive = /^[a-zA-Z]:/.exec(p)
  if (drive) return { root: drive[0], parts: segments(p.slice(drive[0].length)) }
  return { root: /^[\\/]/.test(p) ? sep : '', parts: segments(p) }
}

/** Join a relative path onto a directory, resolving "." and "..", keeping the directory's separator. */
export function joinPath(dir: string, rel: string): string {
  if (isAbsolutePath(rel)) return rel
  const sep = dir.includes('\\') ? '\\' : '/'
  const { root, parts } = splitRoot(dir, sep)
  const out = [...parts]
  for (const segment of rel.split(/[\\/]/)) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') out.pop()
    else out.push(segment)
  }
  const body = out.join(sep)
  if (root === '' || root === sep) return root + body
  return body ? `${root}${sep}${body}` : root
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function encodeSegments(p: string): string {
  return p
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

/**
 * Lower-cased network host of a UNC path ("\\host\…", "//host/…") or of a
 * file URL that names a host ("file://host/…"); null for local paths.
 */
export function uncHost(p: string): string | null {
  if (/^file:/i.test(p)) {
    const host = /^file:\/\/([^/]*)/i.exec(p)?.[1]
    if (host === undefined) return null
    if (host === '') {
      const fourSlash = /^file:\/{4}([^/]+)/i.exec(p)
      return fourSlash ? safeDecode(fourSlash[1]).toLowerCase() : null
    }
    const name = safeDecode(host).toLowerCase()
    return name === 'localhost' ? null : name
  }
  const host = /^[\\/]{2}([^\\/]+)/.exec(p)?.[1]?.toLowerCase()
  // "\\?\C:\…" and "\\.\…" are local device paths, not network hosts.
  return host && host !== '?' && host !== '.' ? host : null
}

/** Absolute filesystem path → file:// URL with each segment percent-encoded. */
export function toFileUrl(absPath: string): string {
  const forward = absPath.replace(/\\/g, '/')
  const unc = /^\/\/([^/]+)(\/.*)?$/.exec(forward)
  if (unc) return `file://${encodeURIComponent(unc[1])}${encodeSegments(unc[2] ?? '')}`
  const rooted = forward.startsWith('/') ? forward : `/${forward}`
  return `file://${encodeSegments(rooted).replace(/^\/([a-zA-Z])%3A/, '/$1:')}`
}

/** file:// URL → filesystem path, or null if it is not one. */
export function fromFileUrl(url: string): string | null {
  if (!/^file:/i.test(url)) return null
  const rest = url.replace(/^file:/i, '')
  if (uncHost(url)) return `\\\\${safeDecode(rest.replace(/^\/+/, '')).replace(/\//g, '\\')}`
  const path = safeDecode(rest.replace(/^\/\/(localhost)?/i, '').replace(/^\/+/, ''))
  return /^[a-zA-Z]:/.test(path) ? path.replace(/\//g, '\\') : `/${path}`
}

/**
 * A document may reach local files and its own network host, but no other
 * host: loading "\\host\…" makes Windows connect over SMB and offer the user's
 * credentials, so a hostile document could harvest them just by being opened.
 */
function reachable(path: string, baseDir: string | null): boolean {
  const host = uncHost(path)
  return host === null || host === (baseDir ? uncHost(baseDir) : null)
}

/**
 * Where an image in a document should load from. Relative paths resolve
 * against the document's folder; web URLs and data: are left alone. Returns ''
 * for anything on a network host other than the document's own.
 */
export function resolveAssetSrc(src: string, baseDir: string | null): string {
  if (src === '' || src.startsWith('#')) return src
  if (hasScheme(src)) return !/^file:/i.test(src) || reachable(src, baseDir) ? src : ''
  const pathPart = safeDecode(src.split(/[?#]/)[0])
  if (isAbsolutePath(pathPart)) return reachable(pathPart, baseDir) ? toFileUrl(pathPart) : ''
  if (!baseDir) return src
  const full = joinPath(baseDir, pathPart)
  return reachable(full, baseDir) ? toFileUrl(full) : ''
}

/** What clicking a link in the preview should do. */
export type LinkTarget =
  | { kind: 'external'; url: string }
  | { kind: 'anchor'; id: string }
  | { kind: 'file'; path: string; anchor: string | null }
  | { kind: 'ignore' }

function localTarget(pathPart: string, anchor: string | null, baseDir: string | null): LinkTarget {
  if (pathPart === '') return anchor ? { kind: 'anchor', id: anchor } : { kind: 'ignore' }
  const path = isAbsolutePath(pathPart) ? pathPart : baseDir ? joinPath(baseDir, pathPart) : null
  return path && isMarkdownPath(path) && reachable(path, baseDir) ? { kind: 'file', path, anchor } : { kind: 'ignore' }
}

/**
 * Classify a link href from a document. Web and mail links go to the browser;
 * "#section" jumps within the preview; links to other Markdown files open in a
 * tab; anything else (executables, custom protocols) is ignored.
 */
export function classifyLink(href: string, baseDir: string | null): LinkTarget {
  const trimmed = href.trim()
  if (trimmed === '') return { kind: 'ignore' }
  if (trimmed.startsWith('#')) return { kind: 'anchor', id: safeDecode(trimmed.slice(1)) }

  if (hasScheme(trimmed)) {
    const scheme = trimmed.slice(0, trimmed.indexOf(':')).toLowerCase()
    if (WEB_SCHEMES.has(scheme)) return { kind: 'external', url: trimmed }
    if (scheme !== 'file') return { kind: 'ignore' }
    const [urlPart, hash] = trimmed.split('#', 2)
    const path = fromFileUrl(urlPart)
    return path ? localTarget(path, hash ? safeDecode(hash) : null, baseDir) : { kind: 'ignore' }
  }

  const hashAt = trimmed.indexOf('#')
  const withoutHash = hashAt >= 0 ? trimmed.slice(0, hashAt) : trimmed
  const anchor = hashAt >= 0 ? safeDecode(trimmed.slice(hashAt + 1)) || null : null
  const pathPart = safeDecode(withoutHash.split('?')[0])
  return localTarget(pathPart, anchor, baseDir)
}
