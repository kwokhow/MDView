/** Shown in an untitled tab on first launch; replaced as soon as a file is opened. */
export const WELCOME = `# Welcome to MDView

*A Markdown editor and viewer by KEC.*

Write Markdown on the **left**; the formatted preview on the **right** updates as you type and scrolls with you.

## Getting around

| Action | Shortcut |
| --- | --- |
| Open files (several at once) | Ctrl+O, or drag files onto the window |
| New tab / close tab | Ctrl+N / Ctrl+W |
| Next / previous tab | Ctrl+Tab / Ctrl+Shift+Tab |
| Save / Save As / Save All | Ctrl+S / Ctrl+Shift+S / Ctrl+Alt+S |
| Editor / Split / Preview | Ctrl+Alt+1 / 2 / 3 |
| Find and replace | Ctrl+F |
| Toggle sidebar / theme | Ctrl+Alt+B / Ctrl+\\\\ |

Your open tabs are restored the next time you start MDView.

## Formatting

**Bold** (Ctrl+B), *italic* (Ctrl+I), ~~strikethrough~~, \`inline code\` (Ctrl+E) and [links](https://www.markdownguide.org/basic-syntax/) (Ctrl+K). Headings with Ctrl+1–3.

- [x] Task lists — tick a box in the preview and the source updates
- [ ] Try it now

> Tables wrap to the window width, and wide ones scroll on their own.

\`\`\`sql
SELECT sample_id, status
FROM   sample
WHERE  received_at >= CURRENT_DATE;
\`\`\`

The **outline** in the sidebar lists every heading — click one to jump to it.
`
