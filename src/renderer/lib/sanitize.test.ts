// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { sanitizePreview } from './sanitize'
import { renderMarkdown } from './markdown'

function toHtml(fragment: DocumentFragment): string {
  const div = document.createElement('div')
  div.append(fragment)
  return div.innerHTML
}

describe('sanitizePreview', () => {
  it('strips scripts, event handlers, javascript: links and <style>', () => {
    const html = toHtml(
      sanitizePreview(
        '<p onclick="x()">hi</p><script>alert(1)</script><a href="javascript:alert(1)">l</a><style>body{display:none}</style>',
        null
      )
    )
    expect(html).not.toMatch(/script|onclick|javascript:|<style/i)
    expect(html).toContain('<p>hi</p>')
  })

  it('keeps the attributes the preview relies on', () => {
    const { html } = renderMarkdown('# Title\n\n- [x] done\n\n| a |\n| --- |\n| 1 |\n')
    const out = toHtml(sanitizePreview(html, null))
    expect(out).toContain('data-line="0"')
    expect(out).toContain('data-heading-id="title"')
    expect(out).toContain('class="task-list-item-checkbox"')
    expect(out).toContain('class="table-wrap"')
  })

  it('keeps table alignment styles but drops any other inline style (e.g. CSS url() loads)', () => {
    const out = toHtml(
      sanitizePreview('<table><tr><td style="text-align:right">1</td><td style="background:url(//evil/x.png)">2</td></tr></table>', null)
    )
    expect(out).toContain('<td style="text-align:right">1</td>')
    expect(out).toContain('<td>2</td>')
  })

  it('removes resource-loading attributes and media the preview does not need', () => {
    const out = toHtml(
      sanitizePreview(
        '<img src="a.png" srcset="//evil/x.png 1x"><table background="//evil/x.png"><tr><td>t</td></tr></table><video poster="//evil/p.png" src="//evil/v.mp4"></video><audio src="//evil/a.mp3"></audio>',
        'C:\\docs'
      )
    )
    expect(out).not.toMatch(/srcset|background=|<video|<audio|poster|evil/)
    expect(out).toContain('src="file:///C:/docs/a.png"')
  })

  it('blanks images that point at another network host', () => {
    const out = toHtml(sanitizePreview('<img src="\\\\evil.example\\s\\x.png" alt="x">', 'C:\\docs'))
    expect(out).not.toContain('evil')
  })

  it('resolves relative images against the document folder and keeps file: URLs', () => {
    const out = toHtml(sanitizePreview('<img src="img/a b.png"><img src="https://x.org/y.png">', 'C:\\docs'))
    expect(out).toContain('src="file:///C:/docs/img/a%20b.png"')
    expect(out).toContain('src="https://x.org/y.png"')
  })
})
