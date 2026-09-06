# QA report — 2.0.2 static-deployment hotfix

Date: **2026-09-06**  
Baseline: conversation package **RMC-ui-readable-v2.0.1.zip**, compared with upstream `4660cf661aeb6a1345e5d16634791f8f13affe77`  
Delivery: ZIP only; the remote repository and its deployed site have **not** been changed by this work.

## Incident findings: distinguish evidence from inference

The inspected GitHub Pages run **34020108949** completed successfully on the inspected commit. The separate **Validate RMC** run **34020109395**, job **101450994022**, failed at the structural check with `FAIL Import: ./sourceFormatter.js` and `81/82 structural checks passed.` The repository retained the obsolete `js/preview.js` file, which imported that absent formatter. The current `main.js` does not import this obsolete preview module. Therefore this CI failure is a confirmed cleanup defect, not proof that it caused the visual failure.

The reported screenshot shows the new application's HTML with no effective application layout or icon sizing. The old 226-byte stylesheet only set the black background, white text, font and selection/scroll behavior, while the current 16,145-byte stylesheet defines the application's layout. Reuse of the same asset URL makes **a new HTML document combined with a stale old stylesheet** the leading hypothesis. Missing/blocked stylesheet delivery or another mixed asset response remains possible. We did **not** obtain the user's actual CSS response, cache headers or browser Console output and do not claim a conclusively established cache root cause.

The current source already has relative asset URLs and `.nojekyll`. Neither a missing `.nojekyll` nor a root-absolute `/css/` reference was found as the cause. GitHub Pages can still host the static HTML, CSS and browser JavaScript without a production Node server.

## Executed results

| Layer | Result | What was actually exercised |
| --- | --- | --- |
| Structural and JavaScript syntax checks | **111/111 passed** | Syntax, local paths with query strings, ARIA targets, obsolete-file detection, `.nojekyll`, manifest version and asset hashes |
| Node unit and integration suite | **69/69 passed** | Existing 57 cases, release/HTTP verifier checks, an actual `/RMC/` localhost server, safe migration dry-run/apply/refusal |
| Separate HTTP deployment CLI | **21/21 passed locally** | Actual local `/RMC/` responses for HTML, manifest and 19 CSS/JS/SVG assets; status, MIME and SHA-256 checks |
| Isolated Chromium UI regression | **96/96 passed** | Actual HTML/CSS and UI utility code, trusted fixed document fixture, multiple viewports and larger root-font settings |
| Isolated Chromium boot-failure regression | **10/10 passed** | Actual watchdog, markup and CSS; deliberately missing CSS, stale marker, simulated module failure and success markers |
| Actual hosted-browser E2E | **Attempted; 0 checks passed** | Navigation to the real local server was blocked before application execution by browser policy |
| Public Pages responses after applying this ZIP | **Not tested** | ZIP was not deployed to the user's repository |
| Exact CDN downloads / vendor mode / public converter execution | **Not verified** | Existing production pins and URLs preserved; no renderer libraries bundled |
| Firefox, Safari, real phones, screen reader | **Not run** | Manual follow-up release checks |

Do not sum the local HTTP CLI's 21 checks into the 69 Node tests: the integration suite also invokes the verifier, and this is overlapping evidence. These results are not a production compatibility certificate, a security audit or a WCAG conformance claim.

## Evidence files

- [Structural and Node execution log](qa/2.0.2/core.log)
- [Actual local project-prefix HTTP log](qa/2.0.2/http-project-path.log) and [JSON](qa/2.0.2/http-project-path.json)
- [UI log](qa/2.0.2/ui.log) and [measurements/results](qa/2.0.2/ui/results.json)
- [Watchdog log](qa/2.0.2/boot.log) and [results](qa/2.0.2/boot/results.json)
- [Actual hosted-browser attempted run](qa/2.0.2/hosted.log) and [failure record](qa/2.0.2/hosted-results.json)
- [Archived 2.0.1 report](QA-REPORT-2.0.1.md) and [archived 2.0.0 report](QA-REPORT-2.0.0.md)

Environment: Node.js **22.16.0**, Python **3.13.5**, Chromium **144.0.7559.96**, Playwright **1.57.0**. The managed browser returned `net::ERR_BLOCKED_BY_ADMINISTRATOR` at the localhost URL. No policies were disabled or bypassed. Outbound container network requests were also unavailable. Node's local HTTP client could access the local server; this is distinct from browser execution.

## Regression scope

`tests/deployment.test.mjs` verifies the release query on HTML assets, local ES imports and Worker/export CSS URLs, the distributed manifest bytes, bounded intrinsic SVG sizes, project-subpath handling, HTTP 200 with stale CSS, HTML returned as a stylesheet, and absent JavaScript. Its actual HTTP case starts the shipped server at `/RMC/`, verifies trailing-slash redirection and rejects root-absolute asset access.

`tests/migration.test.mjs` uses the known original MIT-licensed preview file as a fixture. A default invocation changes no files. `--apply` moves known unchanged legacy files to a sibling backup directory outside the web root. Content differing from the original is not moved. CRLF/LF checkout variants are recognized. It does not touch browser storage, `.git`, CNAME or current runtime files. Do not merely overlay the ZIP and assume obsolete files have disappeared; follow [UPGRADE-KR.md](../UPGRADE-KR.md).

`tests/boot.py` mounts the actual HTML/CSS/independent boot script into an isolated in-memory page. The success marker is explicitly supplied by the test rather than by running `main.js`. It demonstrates failure diagnostics and intrinsic icon sizing, not live module execution or a successful renderer. The shipped page retains its CSP. If the watchdog itself is blocked, it cannot display a warning.

`tests/ui_layout.py` uses the actual HTML/CSS with a fixed trusted document and selected actual UI utilities. It does not execute the converter, app controller, autosave, Worker, clipboard or export. The desktop and mobile screenshots in `docs/screenshots/` are produced by this harness, **not screenshots of the public site**. `css/document.css` and the tested canvas typography remain unchanged from the earlier refactor.

The real hosted suite now explicitly verifies the stylesheet release marker and computed flex/grid layout before counting renderer startup. This prevents a rendered preview in an unstyled page from being mistaken for a fully styled startup. The new assertion was syntax-checked, but could not run because navigation failed first.

## Before considering the public incident closed

Apply the package with the documented legacy cleanup, review the diff and push the desired changes. Keep the existing branch-based Pages publishing source (`main`, `/(root)`) when that is the chosen deployment mode. Do not clear site data: drafts are stored there. After Pages deployment succeeds, use a hard reload or Network → Disable cache while DevTools is open.

Run the read-only deployment verifier against the actual URL:

```bash
npm run check:deployment -- https://jtech-co.github.io/RMC/
```

Then run `npm run test:browser` in an environment where real browser networking is permitted, and verify input, rendering, local persistence, export and mobile behavior on the public site. A 21/21 HTTP result alone does not prove CSP, external CDN availability, a real Worker or system clipboard execution. For local vendoring, separately run and review `npm run vendor`, `npm run vendor:check` and `npm run check:all` before browser testing. No exact CDN asset download is claimed here.

When editing runtime files, bump the package version and run `npm run release:stamp` before committing. The generated `release.json` and all runtime URLs must be committed together. The manifest detects byte mismatch; it is not an independent signature or a guarantee against a malicious server.

## Primary sources inspected

- [Inspected commit](https://github.com/JTech-CO/RMC/commit/4660cf661aeb6a1345e5d16634791f8f13affe77)
- [Successful Pages run](https://github.com/JTech-CO/RMC/actions/runs/34020108949)
- [Failed CI run](https://github.com/JTech-CO/RMC/actions/runs/34020109395)
- [Retained obsolete preview module](https://github.com/JTech-CO/RMC/blob/4660cf661aeb6a1345e5d16634791f8f13affe77/js/preview.js)
- [Original small stylesheet](https://github.com/JTech-CO/RMC/blob/748248cb3401b9142f5dbef1274c2bc044011cec/css/styles.css)
- [GitHub Pages: static hosting](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub Pages: publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [MDN: HTTP caching and versioned URLs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)
- [Chrome DevTools: Network reference](https://developer.chrome.com/docs/devtools/network/reference)
