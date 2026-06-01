import { join } from 'node:path'
import { app, dialog, nativeImage, shell, BrowserWindow } from 'electron'

/** Resolve the bundled app icon for dialogs (works in dev and packaged). */
function appIcon(): Electron.NativeImage {
  // In packaged builds resources sit next to the asar; in dev, use build/.
  const candidates = [
    join(process.resourcesPath ?? '', 'icon.png'),
    join(app.getAppPath(), 'build', 'icon.png'),
    join(app.getAppPath(), '..', 'build', 'icon.png')
  ]
  for (const path of candidates) {
    const img = nativeImage.createFromPath(path)
    if (!img.isEmpty()) return img
  }
  return nativeImage.createEmpty()
}

const APP_NAME = 'MDView'
const VENDOR = 'KEC'

/** Configure the native macOS/Windows about panel metadata. */
export function configureAboutPanel(): void {
  app.setAboutPanelOptions({
    applicationName: APP_NAME,
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    copyright: `Copyright © 2026 ${VENDOR}`,
    authors: [VENDOR],
    website: 'https://www.markdownguide.org/'
  })
}

/** Show a branded About dialog. */
export async function showAbout(parent?: BrowserWindow | null): Promise<void> {
  const detail = [
    `Version ${app.getVersion()}`,
    '',
    'A live-WYSIWYG Markdown editor.',
    'Type Markdown and watch it render in place — open, edit,',
    'save, and read .md files comfortably on Windows.',
    '',
    `Built with Electron ${process.versions.electron} and Milkdown.`,
    '',
    `© 2026 ${VENDOR}. Released under the MIT License.`
  ].join('\n')

  const result = await dialog.showMessageBox(parent ?? BrowserWindow.getFocusedWindow() ?? undefined as never, {
    type: 'none',
    icon: appIcon(),
    title: `About ${APP_NAME}`,
    message: `${APP_NAME} by ${VENDOR}`,
    detail,
    buttons: ['OK', 'Markdown Guide'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  })

  if (result.response === 1) {
    void shell.openExternal('https://www.markdownguide.org/basic-syntax/')
  }
}
