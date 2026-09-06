# Deployment and upgrade

## Replacing the old project

This is a **complete replacement source tree**, not a patch to append below the old files. Back up the repository working tree and export important in-browser Markdown first. Copy the contents of `RMC/` into the repository root while preserving the repository's `.git/` directory and any separately managed domain configuration such as `CNAME`. The archive does not contain a `.git/` directory or change the remote repository.

Remove obsolete app assets after reviewing the diff: old `css/scrollbar.css`, `js/autoSave.js`, `js/preview.js`, `js/sourceFormatter.js`, `js/scrollSync.js`, `scripts/check.js`, `scripts/e2e-smoke.js`, and old deployment dependencies are no longer referenced. Their replacements use the structure described in README. Keeping unused old assets does not activate them, but it obscures maintenance and audits.

The original legacy draft keys are left intact. The first new-version visit migrates an existing raw draft only when no v2 record exists, on the same origin. Rolling back to v1 will read the old legacy copy, not later v2 edits. Export the current v2 document before rolling back; do not assume bidirectional schema synchronization.

## Local preflight

```bash
npm ci
npm run check:all
npm run dev
```

Open the localhost URL printed by the server. Verify a Korean document, a multiline code block, a table, new/restore, file open, MD/HTML exports, clipboard permission denial and a narrow viewport. Do not treat core tests alone as a completed browser release gate.

For locally hosted dependencies and genuine browser checks:

```bash
npm run vendor
npm run vendor:check
python -m pip install -r tests/requirements.txt
python -m playwright install chromium
npm run test:browser
```

The vendoring step requires outbound HTTPS and fails explicitly on unavailable/wrong-version files. Review `vendor/manifest.json`, licenses and `js/runtime-urls.js`. This authoring handoff did not complete that network download. CI is supplied to run it in a normal network-enabled environment.

## GitHub Pages: branch deployment

Place `index.html` at the repository root along with `css/`, `js/`, `assets/` and optionally `vendor/`. In the repository's Pages settings choose branch deployment and the root directory of the desired branch. There is no build output directory. Retain `.nojekyll`. All app paths are relative and support a project path such as `/RMC/`.

In CDN mode those folders are enough to serve the app, but client access to the pinned library hosts is required. In local mode deploy the complete `vendor/` directory and the corresponding modified `runtime-urls.js` together. A partial upload will break loading. Test the final published URL because hosting MIME, CSP and base-path behavior is outside the unit suite.

## GitHub Pages: optional manual workflow

`.github/workflows/pages.yml` runs **only via workflow_dispatch**. Select GitHub Actions as the Pages source, then manually run “Deploy Pages (manual)”. It vendors dependencies, verifies hashes, packages only runtime assets, and deploys them. It does not publish on every push by default. Required Pages permissions and environment configuration depend on repository settings. The workflow has been supplied, not executed during this handoff.

`.github/workflows/ci.yml` is separate: it checks pushes/pull requests, vendors the renderer and runs the real browser suite. A failing CDN download or browser test fails CI instead of using compatibility fixtures.

## Other static hosts

Publish `index.html`, `.nojekyll`, `assets/`, `css/`, `js/` and, in local mode, `vendor/`. No backend, secrets or environment variables are required in the deployed application. Serve JavaScript with a JavaScript MIME type and CSS as `text/css`; enable HTTPS. Do not publish local QA output, test fixtures or development environment files as runtime assets.

The HTML includes a meta CSP. Add deployment headers where supported, including `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and `Content-Security-Policy: frame-ancestors 'none'` to complement it. The latter cannot be provided by a meta tag. A host-specific CSP must still allow the configured library locations, same-origin workers and document style loading. Test rather than blindly replacing the existing policy.

## Known operational boundaries

There is no service worker, cache invalidation daemon, authentication or server-side saving. Browser-local drafts are not a data backup system. In particular, GitHub project paths on the same hostname share an origin; other scripts hosted at that origin are not isolated from localStorage. Use a separate origin for sensitive independent applications.

The optional dev server binds to 127.0.0.1. Do not expose it as an internet-facing application server. For production use the static host's normal infrastructure. Clipboard APIs may depend on secure context and user permissions; a failure is surfaced, not reported as a successful copy. Test Safari, Firefox, real touch keyboards and at least one screen reader before announcing broad browser/accessibility support.
