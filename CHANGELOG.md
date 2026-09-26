# Changelog

All notable changes to MDView are documented here.

## [2.0.0] — 2026-09-25

A redesign around a split view: raw Markdown on the left, formatted preview on
the right.

### Added
- **Split view** with a live, read-only formatted preview. Switch between
  Editor, Split and Preview (`Ctrl+Alt+1/2/3`); drag the divider to resize,
  double-click it to reset.
- **Sync scroll**: the preview follows the editor to the same source line, and
  the editor follows the preview when you scroll that instead.
- **Tabs**: open many files at once (multi-select in Open, or drag files onto
  the window); `Ctrl+Tab` to cycle, `Ctrl+W` to close, **Save All**. Each tab
  keeps its own cursor and undo history.
- **Session restore**: open tabs and the active tab come back next launch.
- **Sidebar** with the open-files list and a heading **outline** that tracks the
  section you are reading.
- **Formatting toolbar** and **Format** menu: bold, italic, strikethrough, code,
  links, headings, lists, task lists, quotes, code blocks, tables, rules.
- Task checkboxes can be ticked in the preview; links to other `.md` files open
  them in a tab; `#section` links jump within the document; relative images
  display.
- Status bar with cursor position, word/character/line counts and reading time.

### Changed
- New GitHub-style colour scheme for the chrome, editor and preview, with a
  matching dark theme.
- Prose wraps to each pane and reflows on resize; code blocks keep their shape
  and scroll sideways instead of wrapping.
- The WYSIWYG editor and Source Mode are replaced by the split view.

### Security
- Preview HTML is sanitized; the window can no longer be navigated by a link or
  a dropped file; only http/https/mailto links are handed to the browser.

## [1.1.0] — 2026-09-23

### Added
- **Source Mode** (**View → Source Mode**, `Ctrl+E`): view and edit the raw
  Markdown with a line-number gutter, Markdown syntax highlighting (including
  fenced code), search (`Ctrl+F` opens the source search panel), and undo
  history. The status bar shows the cursor's `Ln, Col`. Edits flow both ways —
  switching back re-renders the live view from the source text, and saving
  always writes whichever view you are editing.
- **View → Line Numbers** checkbox: hides or shows the line-number gutter in
  both the source view and the live view's fenced code blocks instantly; on by
  default and remembered. (Live code blocks have always been numbered once
  you click into them; this makes that gutter switchable.)

## [1.0.3] — 2026-07-16

### Changed
- Spell checking is now **off by default**. The whole document is one editable
  surface, so the dictionary underlined every code token, identifier and product
  name with red squiggles. Re-enable it any time from **View → Check Spelling**;
  the choice is remembered.

### Fixed
- Table cells no longer overlap when a table is narrower than its content.
  Cell text now wraps (including long `snake_case` identifiers and URLs), and a
  table that is genuinely too wide scrolls on its own instead of colliding.
- Long URLs and identifiers in paragraphs and lists wrap instead of forcing the
  page to scroll sideways; code blocks scroll independently.
- Increased line height for more comfortable reading of long documents.

## [1.0.2] — 2026-06-09

### Fixed
- Fixed a startup race introduced in 1.0.1 where the editor's stylesheet could
  render as raw text at the top of a document when reopening the last file. The
  editor now mounts exactly once with the correct content, and all editor
  create/destroy operations are serialized so they can never interleave. No
  files were ever corrupted by this display glitch, but saving while it showed
  could have written the stray text — this removes that risk.

## [1.0.1] — 2026-06-05

### Added
- Reopen the last opened file automatically on startup. When you launch MDView
  without opening a specific file, it restores the document from your previous
  session (if it still exists on disk). Opening a file via the command line or
  "Open with" still takes precedence.

## [1.0.0] — 2026-06-01

First public release.

### Features
- Live-WYSIWYG Markdown editing — type Markdown and it renders in place
  (headings, bold/italic/strike, lists, task lists, tables, fenced code with
  syntax highlighting, images, links, quotes, horizontal rules).
- Open / Save / Save As / New with native file dialogs and drag-and-drop.
- File associations for `.md` and `.markdown` (open-with, double-click).
- Light / dark theme, reading mode, zoom, in-document find (Ctrl+F).
- Recent files, single-instance handling, and an unsaved-changes close guard.
- Window size, theme, and preferences persist between sessions.
- About dialog with version and KEC attribution.

### Distribution
- Windows NSIS installer and a standalone portable executable.
