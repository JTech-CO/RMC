# R.M.C. — Real-time Markdown Converter

**A focused, dark Markdown workspace. Write, preview and export — without an account or backend.**

[한국어](README-KR.md) · [Deployment](docs/deployment.md) · [Architecture](docs/ARCHITECTURE.md) · [Refactor audit](docs/AUDIT-KR.md) · [QA and limitations](docs/QA-REPORT.md)

![R.M.C. desktop workspace](docs/screenshots/desktop.png)

> This is the **2.0.1 UI-readability revision**, based on upstream `main` at `748248cb3401b9142f5dbef1274c2bc044011cec`. It is not an already-published upstream release. The screenshots use the real application markup/CSS with a fixed sample document in an isolated layout harness. They are not proof of a hosted renderer run. See the QA report for the exact scope.

## UI readability update (2.0.1)

Menus, action buttons, filename and view tabs now use **16px** text at the default root size; save state, hints and the status bar use **14px**. UI labels use the system sans-serif stack instead of small tracked monospace text. Neutral near-white text, clearly outlined controls, square panel/dialog corners and limited blue selection/focus accents keep the dark workspace readable. Disabled actions use dashed borders rather than opacity-faded labels.

This update targets the **application chrome, not the document**. Editor font sizes, preview typography, HTML source styling and `css/document.css` (also used for export) are unchanged. On small screens some direct toolbar actions move into the File menu rather than shrinking text. Help remains available in that menu. UI tokens are grouped under `--ui-*` in `css/styles.css`.

[Mobile editor](docs/screenshots/mobile.png) · [Mobile preview](docs/screenshots/mobile-preview.png) · [Settings](docs/screenshots/settings.png) · [Korean change notes](docs/UI-UPDATE-KR.md)

## What it does

R.M.C. converts Markdown into a live preview and a copyable HTML fragment. Its original dark, IDE-like identity is retained, with a resizable two-pane desktop workspace and a single-pane mobile switcher. There is no framework, bundler, runtime CSS generator, icon font or external web font.

The editor supports common Markdown and GFM tables, task lists, fenced code, links and strikethrough. A formatting toolbar and keyboard shortcuts work with the current selection. Preview, HTML source, copied HTML and exported HTML share one sanitized output pipeline. Code whitespace is preserved rather than changed by an HTML pretty-printer.

Drafts save to this browser. New/open/restore operations use a confirmation and one previous-document recovery slot. The application imports UTF-8 `.md`, `.markdown` and `.txt` files, exports Markdown, exports a styled HTML document, and copies Markdown or an HTML fragment. HTML export stays dark on screen; print styles use a light paper layout.

## Start locally

Use **Node.js 22 or later** for the development tools:

```bash
cd RMC
npm run dev
```

Open **http://127.0.0.1:8000**. No npm packages need to be installed to serve or run the Node checks. `npm ci` is supported for CI; the lockfile intentionally has no npm dependencies.

Do not open `index.html` using `file://`. ES modules, Web Workers and stylesheet fetching need an HTTP(S) origin. The supplied server binds to localhost only and is a development server, not a public production server.

On Windows PowerShell, use `npm.cmd run dev` if execution policy prevents `npm.ps1`. Set `PORT` to use another port; changing the origin also changes which browser draft storage is visible.

## Dependencies and network access

The default ZIP is a **static-source package with CDN-loaded rendering libraries**, not an offline bundle. App HTML, CSS, icons and modules are local. Library versions are explicit, never `latest`:

| Component | Pinned version | Role |
| --- | --- | --- |
| Marked | 18.0.11 | Markdown parsing inside a Web Worker |
| DOMPurify | 3.4.14 | HTML sanitization |
| highlight.js | 11.12.0 | Common-language syntax highlighting |

Versions were selected from upstream documentation/releases on **2026-09-06**. The actual pinned CDN assets could not be fetched and exercised end-to-end in the authoring environment. The delivered hosted-browser test and CI workflow are provided to close that verification gap. See [QA](docs/QA-REPORT.md), not just the version table, before deployment.

To host the libraries locally, run this once in a network-enabled environment:

```bash
npm run vendor
npm run vendor:check
npm run check:all
```

This downloads the exact libraries and their licenses into `vendor/`, records SHA-256 hashes, and switches `js/runtime-urls.js` to relative local URLs **only after all downloads succeed**. Review and commit `vendor/` and `js/runtime-urls.js` together. No font files are downloaded. A downloaded hash records local integrity; it is not independent proof of publisher authenticity. Read [vendor/README.md](vendor/README.md).

The app contains no analytics, account system or document-upload endpoint. In CDN mode the browser contacts library CDNs. Remote Markdown images are blocked by default; enabling **Load external images** permits HTTPS image requests and may reveal the visitor's IP address to image hosts. Opening a link navigates to that website. Local vendoring does not add a service worker or guarantee offline caching of a remotely hosted page.

## Draft protection and migration

The new schema uses `rmc_document_v2`, `rmc_backup_v2` and `rmc_settings_v2`. A valid legacy `rmc_content_dark` draft, **including an intentionally empty string**, is imported when no v2 draft exists. Legacy keys are not deleted. The old `rmc_content_backup` recovery record is also readable.

Migration requires the **same browser profile and origin** as the original app. For example, changing the hostname, scheme or port does not transfer localStorage. Export important Markdown before changing the deployment origin or clearing browser data. This is a local draft, not encrypted storage, a cloud backup or full version history.

Autosave runs after a short idle period and attempts a synchronous flush when the page hides or unloads. Abrupt process termination and storage failures can still lose recent edits. Blocked/full storage produces a visible warning; Markdown export stays available. A detected update from another tab pauses autosave and asks which version to keep. Conflict checks are best effort, not a transactional collaborative editor: a truly simultaneous read/write race is still possible. Keep one editing tab for important work.

## Controls

| Action | Control |
| --- | --- |
| Open a Markdown file | Open / File menu / `Ctrl` or `⌘` + `O` |
| Export Markdown | Export MD / `Ctrl` or `⌘` + `S` |
| Bold, italic, link | Toolbar / `Ctrl` or `⌘` + `B`, `I`, `K` |
| Resize desktop panes | Drag divider; arrows when focused; Home or double-click resets |
| Switch output | Preview / HTML source tabs; arrow keys within tablist |
| Mobile editing | Markdown / Preview / HTML buttons |
| Restore previous document | File → Restore previous document |

Plain single-line breaks render as `<br>` by default, preserving the old app's behavior; disable **Soft line breaks** in settings for normal paragraph wrapping. Tab is left available for keyboard navigation rather than trapped for indentation.

## Boundaries

The import cap is **512 KiB**. Preview is capped at **300,000 UTF-16 code units** and generated HTML at **2,000,000 code units**. Parser jobs have a timeout; an over-limit or failed preview does not block Markdown export. DOM sanitization and highlighting still run on the main thread with limits; this is not a general resource-exhaustion guarantee.

Raw HTML has an intentionally restricted allowlist. Scripts, inline styles, arbitrary classes/IDs, SVG, MathML, iframes, active forms and unsafe URL schemes are not retained. Task checkboxes are read-only. HTTPS images require opt-in; supported inline base64 raster images can remain. Relative images are not imported or rewritten. Only explicitly recognized fenced-code languages are highlighted; unknown languages remain plain text. Heading anchor IDs are not generated. There is no built-in LaTeX, Mermaid, multi-file project, rich-text editing or cloud sync.

An HTML export contains its document styles and sanitized content, with no rendering scripts. Opted-in external images are still external, not embedded. **Copy HTML** copies a fragment without document styles. A download notification means that the browser download was requested, not that the OS has confirmed a file was written.

## Quality checks

```bash
npm run check:all
```

This runs structural/syntax checks and Node unit/HTTP tests. It **does not run browser E2E**.

For the independent UI layout/typography checks (no CDN access required):

```bash
python -m pip install -r tests/requirements.txt
python -m playwright install chromium
npm run test:ui
```

Set `RMC_CHROME_PATH` to use an installed Chromium, or run `python tests/ui_layout.py --browser <path>`. The checked-in baseline records canvas styles from the 2.0.0 package. `--baseline-root <unpacked-original-RMC>` optionally compares with the original CSS directly. This suite uses a fixed trusted document and actual `ui.js` menu/splitter utilities; it does not run the Markdown renderer, app controller, worker or storage. Results are written to `.test-results/ui-layout/`.

For the actual hosted-browser suite:

```bash
python -m pip install -r tests/requirements.txt
python -m playwright install chromium
npm run test:browser
```

The runner starts a localhost server and uses the real runtime, CSP, worker, localStorage and download APIs. Use `RMC_CHROME_PATH` or `python tests/browser.py --browser <path>` to select an installed browser, and `--base-url <url>` to test an existing server. Outputs go to `.test-results/`. Network failures are failures, not silently replaced dependencies. `tests/components.py` is a separate fixture-based component harness and is **not** a substitute for E2E.

The included CI workflow runs core checks, then vendors dependencies and runs browser smoke tests. A manually dispatched Pages workflow publishes only runtime assets. Neither workflow was executed against the remote repository during this handoff.

## Project layout

```text
index.html                 Accessible workspace markup and CSP
css/                       Application, editor, preview and exported-document styles
js/                        Application controller and focused runtime modules
assets/                    Local SVG favicon
scripts/                   Dependency-free dev server, checks, optional vendoring
tests/                    Node tests and Python browser/component runners
vendor/                    Optional local third-party assets and licenses
docs/                     Deployment, architecture, audit, QA and screenshots
.github/workflows/         CI and manually triggered Pages deployment
README.md                  English documentation
README-KR.md               Korean documentation
```

## License

Application code: [MIT](LICENSE), **Copyright (c) 2026 JTech_CO**, preserving the upstream notice. Rendering libraries keep their own licenses; vendoring retrieves those notices. Updating dependencies still requires reviewing their release notes and rerunning the real-browser suite.
