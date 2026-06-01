import { readFile, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { app, dialog, BrowserWindow } from 'electron'
import type { OpenedFile, SavedFile } from '../shared/types'

const MD_FILTERS = [
  { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
  { name: 'Text', extensions: ['txt'] },
  { name: 'All Files', extensions: ['*'] }
]

/** Read a markdown file from disk as UTF-8. */
export async function readMarkdownFile(path: string): Promise<OpenedFile> {
  const content = await readFile(path, 'utf8')
  return { path, content }
}

/** Show the open dialog and read the chosen file. Returns null if cancelled. */
export async function openFileViaDialog(win: BrowserWindow): Promise<OpenedFile | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Open Markdown File',
    properties: ['openFile'],
    filters: MD_FILTERS
  })
  if (canceled || filePaths.length === 0) return null
  return readMarkdownFile(filePaths[0])
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

/** Extract a display name from a path. */
export function displayName(path: string): string {
  return basename(path)
}
