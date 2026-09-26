import { readFile, writeFile } from 'node:fs/promises'
import { app, dialog, BrowserWindow } from 'electron'
import type { OpenedFile, SavedFile } from '../shared/types'

const MD_FILTERS = [
  { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mkdn'] },
  { name: 'Text', extensions: ['txt'] },
  { name: 'All Files', extensions: ['*'] }
]

/** Read a markdown file from disk as UTF-8. */
export async function readMarkdownFile(path: string): Promise<OpenedFile> {
  const content = await readFile(path, 'utf8')
  return { path, content }
}

/** Read several files, skipping any that are missing or unreadable. */
export async function readMarkdownFiles(paths: readonly string[]): Promise<OpenedFile[]> {
  const results = await Promise.allSettled(paths.map((p) => readMarkdownFile(p)))
  return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
}

/** Show the open dialog (multi-select) and read the chosen files. [] if cancelled. */
export async function openFilesViaDialog(win: BrowserWindow): Promise<OpenedFile[]> {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Open Markdown Files',
    properties: ['openFile', 'multiSelections'],
    filters: MD_FILTERS
  })
  if (canceled || filePaths.length === 0) return []
  return readMarkdownFiles(filePaths)
}

/** Write content to an existing path. */
export async function saveToPath(path: string, content: string): Promise<void> {
  await writeFile(path, content, 'utf8')
}

/** Show the save-as dialog and write content. Returns null if cancelled. */
export async function saveViaDialog(
  win: BrowserWindow,
  content: string,
  suggestedName?: string
): Promise<SavedFile | null> {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Save Markdown File',
    defaultPath: suggestedName ?? 'untitled.md',
    filters: MD_FILTERS
  })
  if (canceled || !filePath) return null
  await writeFile(filePath, content, 'utf8')
  return { path: filePath }
}

/** Register a successfully opened file with the OS recent-documents list. */
export function addRecentDocument(path: string): void {
  app.addRecentDocument(path)
}
