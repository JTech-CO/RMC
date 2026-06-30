# Deployment and Dependency Notes

R.M.C. is a serverless static web app. The production entry point is `index.html`, with local CSS in `css/` and ES modules in `js/`.

## Run Locally

Use an HTTP server instead of opening `index.html` directly from the filesystem. The app uses ES module imports, and browser behavior for module loading is more reliable from `http://localhost` than from `file://`.

```bash
npm install
npm run dev
```

Alternative commands:

```bash
npm run serve
npm run preview
```

- `dev`: runs `live-server` on port 8000 and opens `/index.html`.
- `serve`: runs `http-server` on port 8000, disables cache, and opens `/index.html`.
- `preview`: runs `http-server` on port 8000 with cache disabled and no automatic browser open.

Before deployment, run:

```bash
npm run check
```

This validates JSON files, required project files, local HTML references, JavaScript module syntax, import targets, documentation links, and the current UI wiring contract.

For browser-level smoke checks, run:

```bash
npm run check:e2e
```

Use `npm run check:all` to run both static and browser checks. On Windows PowerShell, use `npm.cmd run check`, `npm.cmd run check:e2e`, or `npm.cmd run check:all` if `npm.ps1` is blocked by the execution policy.

## Static Deployment

Deploy these files and folders:

- `index.html`
- `css/`
- `js/`
- `README.md` and `docs/` if repository documentation should be visible

Do not deploy `node_modules/`. It is only needed for local development servers.

For GitHub Pages:

1. Push the repository.
2. Open repository Settings.
3. Go to Pages.
4. Select the branch and root folder containing `index.html`.
5. Run `npm run check:all` locally before publishing changes.
6. Wait for Pages to publish the site.

## CDN Dependencies

Runtime libraries are loaded from CDNs in `index.html`:

- Tailwind CSS CDN with typography plugin
- marked 9.1.2
- DOMPurify 3.0.6
- Highlight.js 11.9.0
- Font Awesome 6.4.0
- Google Fonts: JetBrains Mono and Noto Sans KR

This keeps the app serverless and build-free, but it also means the browser needs network access for first load styling, fonts, icons, markdown parsing, sanitization, and syntax highlighting. A future hardening step can vendor or bundle these dependencies if offline support or stronger supply-chain control becomes a requirement.

## Source of Truth

- `index.html` is the current app shell and deployment entry point.
- `js/markdown.js` owns Markdown to sanitized HTML conversion.
- `js/sourceFormatter.js` owns formatted HTML Source output.
- `js/main.js` owns app state and UI event wiring.

## Cache Notes

During local review, use `npm run serve` or `npm run preview` because both pass `-c-1` to `http-server`, disabling cache. This avoids stale JS modules while refactoring.
