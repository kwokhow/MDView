# Changelog

All notable changes to MDView are documented here.

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
