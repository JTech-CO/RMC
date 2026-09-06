# QA report — scope, evidence and remaining release gates

Handoff date: **2026-09-06**  
Package: **R.M.C. 2.0.0 refactor handoff** (not a published upstream release)  
Baseline: `748248cb3401b9142f5dbef1274c2bc044011cec`

## Outcome at a glance

| Layer | Result | What this establishes |
| --- | --- | --- |
| Node unit and actual localhost HTTP tests | **57/57 passed** | Pure logic, storage/error mocks, filename/text handling, copy failure logic, export construction, serving real local files |
| Structural/syntax checks | **70/70 passed** | JavaScript parses; local imports/assets and ARIA targets resolve; required docs/CSP present |
| Isolated Chromium component suite | **35/35 passed** | Actual app DOM/CSS and controller behavior under explicitly mocked browser boundaries and older real library fixtures |
| Actual hosted-browser suite | **Attempted; blocked before first check** | No hosted-browser pass is claimed |
| Production-pinned asset download / vendoring | **Not completed** | CDN configuration and download script provided; exact downloaded bytes not verified here |
| Remote GitHub Actions / GitHub Pages | **Not run** | Workflow files provided, remote repository unchanged |
| Safari / Firefox / real mobile / screen reader | **Not run** | Manual release gates remain |

**This is not a full production compatibility certificate, security audit, performance benchmark or WCAG conformance claim.**

## Environment

Node.js **22.16.0**, Python **3.13.5**, Playwright **1.57.0**, Chromium **144.0.7559.96** in a Linux authoring container.

The installed Chromium is managed by a policy that blocks navigation to URLs, including the local HTTP test server. The actual browser runner returned `net::ERR_BLOCKED_BY_ADMINISTRATOR` at the localhost URL. Outbound asset retrieval from this container was also unavailable. Policies were not disabled or bypassed. Node's HTTP client could still test the local server; that is the HTTP coverage counted above, not proof that browser navigation works in this environment.

## Executed core tests

Command:

```bash
npm test
```

The 57 tests are in `tests/core.test.mjs` and `tests/server.test.mjs`. Evidence: [unit log](qa/unit.log).

Coverage includes Windows-reserved/path-unsafe filenames, extensions and Unicode, escaping and line-ending normalization, code-point counts/cursor data, zero-height/clamped scroll ratios, safe/unsafe links, empty versus missing drafts, non-destructive legacy migration, malformed/unsupported records, blocked storage, quota failure, cross-tab changed-value detection, backup validation and empty backups, settings defaults/failure, formatting selections/placeholders/backtick fences, generated HTML and code whitespace, debounce/cancel, and failed clipboard return values.

The seven HTTP tests start the **actual** dependency-free Node server on an ephemeral localhost port and verify index/JavaScript/CSS responses, missing files, method restrictions, HEAD semantics and encoded traversal outside the project root. These caught an initial trailing-slash root-path error in the new server, which was corrected before the final run.

Structural evidence is in [structural log](qa/structural.log). `scripts/check.mjs` checks syntax, import and asset existence, HTML ID uniqueness, ARIA references, no old runtime CSS/font CDN, no inline event handlers and documentation presence. These checks do not simulate a layout engine or validate every CSS declaration.

## Executed browser component checks — important distinction

The browser suite in `tests/components.py` uses `tests/component_harness.py`. It mounts the **actual application markup and styles into an in-memory page**, assembles the actual source modules for the harness, and runs the application controller. It uses real locally available renderer fixtures:

| Fixture used for component verification only | Version |
| --- | --- |
| Marked | **16.3.0** |
| DOMPurify | **3.2.6** |
| highlight.js | **11.0.1** |

These are **not** the production pins (18.0.11 / 3.4.14 / 11.12.0). They were already available in the environment and are **not distributed in the ZIP**. Their age is a material limitation: a pass does not establish production-version compatibility or sanitizer security.

For this suite, localStorage is an in-memory map; Worker transport is mocked while executing the application's actual worker message-handler code; stylesheet fetches return the local stylesheet; Blob downloads are captured in memory. The app's CSP is omitted **only from the isolated test document** so the harness can inject test scripts. The shipped `index.html` retains its CSP. There is no claim here of real worker isolation, real persistence, actual downloads, hosted CSP enforcement or system clipboard success.

The 35 passed checks cover sample rendering/highlighting, desktop overflow, simulated autosave, fenced-code whitespace, soft breaks, exact preview/source equality, prepared HTML export, active HTML/unsafe URLs/remote image policy, disabled task controls, native confirmation focus/cancel/replace/restore, menu keyboard navigation, selection formatting, browser-native undo, unknown code language fallback, keyboard splitter control/reset, denied clipboard feedback, size-limit failure with Markdown export preserved, uncaught errors, mobile pane/source navigation and overflow, legacy empty draft migration, and simulated storage-event pause without replacing text.

Evidence: [component result names](qa/component-results.json), [component log](qa/component.log). The result file identifies caller-supplied fixtures; the exact handoff fixture versions are the table above. To rerun in an appropriately equipped environment, provide a directory with `marked.js`, `purify.js` and `highlight.js` and run:

```bash
python tests/components.py --fixtures <fixture-directory> --browser <browser-path>
```

Do not add those old fixtures to the production `vendor/` directory.

## Visual inspection

[Desktop screenshot](screenshots/desktop-v2.0.0.png): **1440 × 1000**.  
[Mobile screenshot](screenshots/mobile-v2.0.0.png): **390 × 844**.

Both were captured from the component harness and visually inspected. The desktop keeps a dark two-pane workspace and the phone uses a single active pane. No horizontal body overflow was observed at those sizes. This is not a claim that all viewport sizes, translations, operating-system fonts or mobile keyboards have been checked. The screenshots show the sample document, not an actual published site.

## Attempted actual browser test

Command:

```bash
python tests/browser.py --browser /usr/bin/chromium
```

Result: browser navigation blocked; **0 hosted-browser checks passed**, nonzero exit. Evidence: [hosted runner log](qa/hosted-attempt.log) and [hosted result JSON](qa/hosted-attempt.json).

The included `tests/browser.py` deliberately uses a real HTTP page, actual ES modules, configured dependencies, native workers, real localStorage, reloads, browser downloads, UTF-8 file input, actual cross-tab events and mobile contexts. It does not substitute fixture libraries when a dependency fails. The script was syntax-checked and attempted, but its full success path could not be executed here. Its own test code should therefore be reviewed with the first successful run.

## Before public release

1. Run `npm run vendor` and `npm run vendor:check` with working network access. Review exact version files, licenses and hashes; resolve any CDN availability differences without silently falling back to older libraries.
2. Run `npm run check:all` and the hosted suite via `npm run test:browser`. Test both locally vendored mode and CDN mode when both are to be supported.
3. Test the final hosted project URL, including relative asset paths, MIME/CSP, copy/download permissions, fast typing followed by navigation, multiple tabs, empty/corrupt drafts and recovery.
4. Check real Korean IME input, Safari/Firefox, mobile keyboard resizing, screen-reader navigation, reduced motion, zoom and long-content layouts.

The included CI performs the core and local-vendored hosted tests when run in GitHub Actions. The manual Pages workflow is a deployment convenience, not evidence that these release gates have already passed.
