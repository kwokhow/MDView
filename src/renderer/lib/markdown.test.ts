import { describe, expect, it } from 'vitest'
import { renderMarkdown, slugify } from './markdown'

describe('slugify', () => {
  it('matches GitHub anchor ids', () => {
    expect(slugify('Files to have open')).toBe('files-to-have-open')
    expect(slugify('SEGMENT 3 — Where the AI')).toBe('segment-3--where-the-ai')
    expect(slugify('3a · Reading a system')).toBe('3a--reading-a-system')
    expect(slugify('What was cut?')).toBe('what-was-cut')
  })
})

describe('renderMarkdown', () => {
  it('tags blocks with their 0-based source line', () => {
    const { html } = renderMarkdown('# Title\n\nPara one.\n\n- a\n- b\n')
    expect(html).toContain('<h1 data-line="0"')
    expect(html).toContain('<p data-line="2">Para one.</p>')
    expect(html).toMatch(/<li data-line="4">a<\/li>/)
    expect(html).toMatch(/<li data-line="5">b<\/li>/)
  })

  it('collects headings with unique slugs for the outline', () => {
    const { headings, html } = renderMarkdown('# Intro\n\n## Setup\n\ntext\n\n## Setup\n')
    expect(headings).toEqual([
      { level: 1, text: 'Intro', line: 0, slug: 'intro' },
      { level: 2, text: 'Setup', line: 2, slug: 'setup' },
      { level: 2, text: 'Setup', line: 6, slug: 'setup-1' }
    ])
    expect(html).toContain('data-heading-id="setup-1"')
  })

  it('uses plain text for headings with inline markup', () => {
    const { headings } = renderMarkdown('## Use `lis_simulation` **now**\n')
    expect(headings[0].text).toBe('Use lis_simulation now')
  })

  it('renders fenced code highlighted, with its source line and language', () => {
    const { html } = renderMarkdown('text\n\n```sql\nSELECT 1;\n```\n')
    expect(html).toContain('<pre class="code-block" data-line="2" data-lang="sql">')
    expect(html).toContain('<code class="hljs language-sql"><span class="hljs-keyword">SELECT</span>')
  })

  it('escapes code in unknown languages', () => {
    const { html } = renderMarkdown('```nope\n<b>x</b>\n```\n')
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
  })

  it('wraps tables so wide ones scroll instead of overflowing', () => {
    const { html } = renderMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |\n')
    expect(html).toMatch(/^<div class="table-wrap"><table data-line="0">/)
    expect(html).toContain('<tr data-line="2">')
    expect(html.trim()).toMatch(/<\/table>\n?<\/div>$/)
  })

  it('turns [ ] and [x] list items into checkboxes', () => {
    const { html } = renderMarkdown('- [ ] todo\n- [x] done\n- plain\n')
    expect(html).toContain('<ul class="contains-task-list" data-line="0">')
    expect(html).toContain('<li class="task-list-item" data-line="0"><input type="checkbox" class="task-list-item-checkbox"> todo</li>')
    expect(html).toContain('<input type="checkbox" class="task-list-item-checkbox" checked> done')
    expect(html).toContain('<li data-line="2">plain</li>')
  })

  it('linkifies bare URLs', () => {
    expect(renderMarkdown('see https://example.com\n').html).toContain('<a href="https://example.com">')
  })

  it('handles an empty document', () => {
    expect(renderMarkdown('')).toEqual({ html: '', headings: [] })
  })
})
