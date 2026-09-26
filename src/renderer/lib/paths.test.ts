import { describe, expect, it } from 'vitest'
import {
  basename,
  classifyLink,
  dirname,
  fromFileUrl,
  hasScheme,
  joinPath,
  resolveAssetSrc,
  samePath,
  toFileUrl,
  uncHost
} from './paths'

const DOC_DIR = 'C:\\Users\\KH\\Documents\\Claude Workspace\\Panel Session Editor'

describe('basename / dirname', () => {
  it('handles Windows and POSIX separators', () => {
    expect(basename('C:\\a\\b\\file.md')).toBe('file.md')
    expect(basename('/a/b/file.md')).toBe('file.md')
    expect(dirname('C:\\a\\b\\file.md')).toBe('C:\\a\\b')
    expect(dirname('file.md')).toBe('')
  })
})

describe('hasScheme', () => {
  it('recognises URL schemes but not drive letters', () => {
    expect(hasScheme('https://x.org')).toBe(true)
    expect(hasScheme('mailto:a@b.c')).toBe(true)
    expect(hasScheme('C:\\a\\b.md')).toBe(false)
    expect(hasScheme('images/a.png')).toBe(false)
  })
})

describe('joinPath', () => {
  it('resolves . and .. against a Windows folder, keeping backslashes', () => {
    expect(joinPath('C:\\a\\b', './c/d.md')).toBe('C:\\a\\b\\c\\d.md')
    expect(joinPath('C:\\a\\b', '../x.md')).toBe('C:\\a\\x.md')
    expect(joinPath('C:\\a', '../../../x.md')).toBe('C:\\x.md')
  })
  it('keeps POSIX roots', () => {
    expect(joinPath('/home/kh', 'docs/a.md')).toBe('/home/kh/docs/a.md')
  })
  it('returns absolute paths unchanged', () => {
    expect(joinPath('C:\\a', 'D:\\z.md')).toBe('D:\\z.md')
  })
})

describe('samePath', () => {
  it('is case- and separator-insensitive', () => {
    expect(samePath('C:\\Docs\\A.md', 'c:/docs/a.MD')).toBe(true)
    expect(samePath('C:\\Docs\\A.md', 'C:\\Docs\\B.md')).toBe(false)
  })
})

describe('file URLs', () => {
  it('encodes spaces and keeps the drive letter readable', () => {
    expect(toFileUrl('C:\\A B\\x.png')).toBe('file:///C:/A%20B/x.png')
  })
  it('round-trips through fromFileUrl', () => {
    expect(fromFileUrl(toFileUrl('C:\\A B\\x.md'))).toBe('C:\\A B\\x.md')
    expect(fromFileUrl('https://x.org')).toBeNull()
  })
})

describe('resolveAssetSrc', () => {
  it('resolves relative images against the document folder', () => {
    expect(resolveAssetSrc('img/pic one.png', DOC_DIR)).toBe(
      'file:///C:/Users/KH/Documents/Claude%20Workspace/Panel%20Session%20Editor/img/pic%20one.png'
    )
  })
  it('decodes already-encoded relative paths once', () => {
    expect(resolveAssetSrc('img/pic%20one.png', 'C:\\d')).toBe('file:///C:/d/img/pic%20one.png')
  })
  it('leaves URLs, data URIs and untitled documents alone', () => {
    expect(resolveAssetSrc('https://x.org/a.png', DOC_DIR)).toBe('https://x.org/a.png')
    expect(resolveAssetSrc('data:image/png;base64,AA==', DOC_DIR)).toBe('data:image/png;base64,AA==')
    expect(resolveAssetSrc('a.png', null)).toBe('a.png')
  })
})

describe('network (UNC) paths', () => {
  const SHARE_DIR = '\\\\server\\share\\docs'

  it('joins onto a share without losing the leading \\\\ or climbing above the share', () => {
    expect(joinPath(SHARE_DIR, 'img/a.png')).toBe('\\\\server\\share\\docs\\img\\a.png')
    expect(joinPath(SHARE_DIR, '../../../x.md')).toBe('\\\\server\\share\\x.md')
  })
  it('converts UNC paths to and from file URLs', () => {
    expect(toFileUrl('\\\\server\\share\\a b.png')).toBe('file://server/share/a%20b.png')
    expect(fromFileUrl('file://server/share/doc.md')).toBe('\\\\server\\share\\doc.md')
    expect(fromFileUrl('file:////server/share/doc.md')).toBe('\\\\server\\share\\doc.md')
    expect(fromFileUrl('file://localhost/C:/x.md')).toBe('C:\\x.md')
  })
  it('reads the host of UNC paths and host-bearing file URLs', () => {
    expect(uncHost('\\\\Server\\share\\x')).toBe('server')
    expect(uncHost('//server/share/x')).toBe('server')
    expect(uncHost('file://evil.example/s/x.png')).toBe('evil.example')
    expect(uncHost('C:\\x')).toBeNull()
    expect(uncHost('file:///C:/x')).toBeNull()
  })

  // Loading \\host\... makes Windows connect over SMB and offer the user's
  // credentials, so a document may only reach the network host it lives on.
  it('blocks images on another network host', () => {
    expect(resolveAssetSrc('\\\\evil.example\\s\\x.png', 'C:\\docs')).toBe('')
    expect(resolveAssetSrc('//evil.example/s/x.png', 'C:\\docs')).toBe('')
    expect(resolveAssetSrc('file://evil.example/s/x.png', 'C:\\docs')).toBe('')
    expect(resolveAssetSrc('\\\\other\\s\\x.png', SHARE_DIR)).toBe('')
    expect(resolveAssetSrc('x.png', null)).toBe('x.png')
  })
  it('allows images on the same share as the document, and local drives', () => {
    expect(resolveAssetSrc('img/a.png', SHARE_DIR)).toBe('file://server/share/docs/img/a.png')
    expect(resolveAssetSrc('C:\\Pictures\\a.png', 'C:\\docs')).toBe('file:///C:/Pictures/a.png')
    expect(resolveAssetSrc('file:///C:/Pictures/a.png', 'C:\\docs')).toBe('file:///C:/Pictures/a.png')
  })
  it('only follows Markdown links on the same network host', () => {
    expect(classifyLink('\\\\evil\\s\\x.md', 'C:\\docs')).toEqual({ kind: 'ignore' })
    expect(classifyLink('file://evil/s/x.md', 'C:\\docs')).toEqual({ kind: 'ignore' })
    expect(classifyLink('other.md', SHARE_DIR)).toEqual({ kind: 'file', path: '\\\\server\\share\\docs\\other.md', anchor: null })
  })
})

describe('classifyLink', () => {
  it('sends web and mail links to the browser', () => {
    expect(classifyLink('https://example.com', DOC_DIR)).toEqual({ kind: 'external', url: 'https://example.com' })
    expect(classifyLink('mailto:a@b.c', DOC_DIR)).toEqual({ kind: 'external', url: 'mailto:a@b.c' })
  })
  it('treats #fragments as in-document anchors', () => {
    expect(classifyLink('#timing-decision', DOC_DIR)).toEqual({ kind: 'anchor', id: 'timing-decision' })
  })
  it('opens relative Markdown links as files, keeping the anchor', () => {
    expect(classifyLink('other%20doc.md#part-2', DOC_DIR)).toEqual({
      kind: 'file',
      path: `${DOC_DIR}\\other doc.md`,
      anchor: 'part-2'
    })
  })
  it('ignores executables, custom protocols and javascript:', () => {
    expect(classifyLink('setup.exe', DOC_DIR)).toEqual({ kind: 'ignore' })
    expect(classifyLink('javascript:alert(1)', DOC_DIR)).toEqual({ kind: 'ignore' })
    expect(classifyLink('ms-settings:privacy', DOC_DIR)).toEqual({ kind: 'ignore' })
    expect(classifyLink('file:///C:/Windows/notepad.exe', DOC_DIR)).toEqual({ kind: 'ignore' })
  })
  it('allows file: links to Markdown', () => {
    expect(classifyLink('file:///C:/notes/a%20b.md', null)).toEqual({ kind: 'file', path: 'C:\\notes\\a b.md', anchor: null })
  })
  it('ignores relative links in an untitled document (no folder to resolve against)', () => {
    expect(classifyLink('other.md', null)).toEqual({ kind: 'ignore' })
  })
})
