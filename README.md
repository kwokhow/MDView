# MDView · by KEC

<p align="center">
  <img src="build/icon.png" width="128" alt="MDView logo" />
</p>

A **split-view Markdown editor and viewer** for Windows. Raw Markdown on the
left, a live formatted preview on the right that scrolls in step with it. Open
many files in tabs; your session is restored next time. Built as a native
desktop app with Electron.

**MDView by KEC** · MIT License · © 2026 KEC

<p align="center">
  <a href="https://github.com/kwokhow/MDView/releases/latest">Download the latest release</a>
</p>

---

## For users

### Download & install
Grab a build from the **[Releases page](https://github.com/kwokhow/MDView/releases/latest)**
(Windows 10/11, 64-bit):

| File | What it is |
| --- | --- |
| `MDView-Setup-<version>.exe` | Installer. Adds Start-menu and desktop shortcuts and registers `.md` / `.markdown` files so you can double-click or "Open with" MDView. Installing a newer version updates in place. Needs administrator approval. |
| `MDView-<version>-portable.exe` | Single self-contained executable. No install, no admin rights — just run it. Does not register file associations. |

**Installing**
1. Download `MDView-Setup-<version>.exe` and run it.
2. The executables are **unsigned** (no paid code-signing certificate), so Windows
   SmartScreen may say *"Windows protected your PC"* — click **More info → Run anyway**.
3. Approve the administrator prompt, keep the default folder, finish.
4. To make double-clicking a `.md` file open MDView: right-click any `.md` file →
   **Open with → Choose another app → MDView**, and tick **Always**. Pick the
   installed MDView, not a portable copy — a portable file's name changes with
   every version, which would break the association after an update.

To update, run the newer installer over the old one; settings and open tabs are
kept. To remove, use **Settings → Apps → Installed apps → MDView → Uninstall**.

### The window
- **Tabs** along the top, one per open document. A dot on a tab means unsaved
  changes. Middle-click or `Ctrl+W` closes a tab; you are asked before any
  unsaved work is discarded.
- **Sidebar** (toggle with `Ctrl+Alt+B`): the list of open files, and an
  **outline** of the current document's headings. Click a heading to jump to it;
  the section you are reading is highlighted.
- **Toolbar**: formatting buttons, and on the right the **Editor / Split /
  Preview** switch, **Sync** scroll, and the light/dark theme.
- **Status bar**: file path, save state, cursor position, word / character /
  line counts and reading time.

### Editing and reading
- Write Markdown in the editor (line numbers, syntax colouring, find and
  replace). The preview updates as you type.
- Prose wraps to the width of each pane and reflows when you resize the window.
  Code blocks keep their exact shape — box diagrams and aligned SQL are never
  rewrapped — and scroll sideways if they are wider than the pane.
- Tables size to their content, wrap long cells, and scroll on their own when
  they are genuinely too wide.
- Tick a task checkbox in the preview and the source line updates.
- Links: web links open in your browser; `#section` links jump within the
  document; links to other `.md` files open them in a new tab. Images stored
  next to your document display in the preview.
- Drag Markdown files onto the window to open them.

### Keyboard shortcuts
| Action | Shortcut |
| --- | --- |
| New tab / Open files | Ctrl+N / Ctrl+O |
| Save / Save As / Save All | Ctrl+S / Ctrl+Shift+S / Ctrl+Alt+S |
| Close tab | Ctrl+W |
| Next / previous tab | Ctrl+Tab / Ctrl+Shift+Tab |
| Find and replace | Ctrl+F |
| Bold / Italic / Strikethrough | Ctrl+B / Ctrl+I / Ctrl+Shift+X |
| Inline code / Link | Ctrl+E / Ctrl+K |
| Heading 1 / 2 / 3 | Ctrl+1 / Ctrl+2 / Ctrl+3 |
| Editor / Split / Preview view | Ctrl+Alt+1 / Ctrl+Alt+2 / Ctrl+Alt+3 |
| Toggle sidebar / theme | Ctrl+Alt+B / Ctrl+\ |
| Zoom text in / out / reset | Ctrl+= / Ctrl+- / Ctrl+0 |

Lists, task lists, quotes, code blocks, tables and horizontal rules are on the
toolbar and in the **Format** menu.

### Settings that are remembered
Open tabs, the active tab, view mode, split position, sync scroll, sidebar,
text zoom, theme, and window size. **View → Line Numbers** and **View → Check
Spelling** (off by default — Markdown is full of identifiers a dictionary
flags) are remembered too.

---

## For developers

### Stack
- **Electron** (main / preload / renderer) + **electron-vite** + **TypeScript**
- **CodeMirror 6** — the Markdown source editor.
- **markdown-it** — Markdown → HTML for the preview; **highlight.js** for code
  colouring; **DOMPurify** sanitizes the preview HTML.
- **electron-store** — persists settings and the session.
- **electron-builder** — packages the NSIS installer + portable exe.
- **Vitest** — unit tests for the renderer's pure logic.

### Commands
```bash
npm install        # install dependencies
npm run dev        # launch in dev mode with hot reload
npm test           # unit tests (Vitest)
npm run typecheck  # tsc --noEmit for main+preload and renderer
npm run build      # production build into out/
npm run dist       # build + package installers into release/
npm run dist:dir   # build + package unpacked app only (faster, no installer)
node scripts/make-icon.cjs   # regenerate build/icon.ico + icon.png
```

### Project layout
```
src/
├─ main/                 Node side — filesystem, dialogs, OS integration
│  ├─ index.ts            lifecycle, window, single instance, close guard,
│  │                      startup files, navigation hardening
│  ├─ ipc.ts              validated IPC handlers
│  ├─ files.ts            read/write, open/save dialogs, recent documents
│  ├─ external.ts         the only way to open a link (http/https/mailto only)
│  ├─ settings.ts         electron-store: prefs, session, theme, window
│  ├─ menu.ts             application menu → menu:command
│  └─ about.ts
├─ preload/index.ts      contextBridge → window.api (named, typed methods only)
├─ shared/types.ts       IPC channels and the MdViewApi contract
└─ renderer/
   ├─ main.ts             bootstrap and command map
   ├─ app/workbench.ts    tabs, open/save/close, rendering, links, outline
   ├─ lib/                pure logic, each with *.test.ts
   │  ├─ markdown.ts       markdown-it setup: source-line mapping, task lists,
   │  │                    heading anchors, highlighted code
   │  ├─ sanitize.ts       DOMPurify config + relative image paths
   │  ├─ format.ts         formatting commands (bold, headings, lists, …)
   │  ├─ tabs.ts           immutable tab list
   │  ├─ scroll-map.ts     source line ⇄ preview offset interpolation
   │  ├─ paths.ts          paths, file URLs, link classification
   │  └─ stats.ts          word count and reading time
   ├─ ui/                 editor pane, preview pane, scroll sync, tabs,
   │                      outline, toolbar, layout, find bar, status bar
   └─ styles/             app.css (tokens + chrome), preview.css (typography)
```

### Architecture notes
- **Security.** `contextIsolation: true`, `nodeIntegration: false`. The preview
  renders untrusted document HTML, so it is sanitized with DOMPurify; the window
  can never be navigated away, and links reach the OS only through
  `openExternalSafe`, which allows http/https/mailto and nothing else.
- **Scroll sync.** Every rendered block carries its source line
  (`data-line`); the preview measures those blocks and interpolates between
  them. Only the pane the user last touched drives the other, which rules out
  feedback loops.
- **Tabs.** One CodeMirror view is shared; each tab owns an `EditorState`, so
  switching tabs keeps each document's cursor and undo history. A tab is
  unsaved when its text differs from the last saved text.
- **Theming.** All colours are CSS variables keyed off `data-theme`; the editor
  theme and syntax colours use the same variables, so switching theme needs no
  editor rebuild.

### Packaging note
`electron-builder` downloads tool binaries (winCodeSign, NSIS) from GitHub on
first run into `%LOCALAPPDATA%\electron-builder\Cache`. The winCodeSign archive
contains macOS `.dylib` **symlinks** that fail to extract on Windows without
Developer Mode/admin — these are macOS-only and irrelevant to a Windows build.
If the build stalls there, manually extract one copy into the canonical
`winCodeSign\winCodeSign-2.6.0\` folder (ignoring the 2 symlink errors) using
`node_modules/7zip-bin/win/x64/7za.exe`, then re-run.

---

## License
MIT.
