# QA report — 2.0.1 UI-readability revision

Date: **2026-09-06**  
Baseline: the conversation's **RMC-refactored-v2.0.0.zip**  
Remote repository: **unchanged**

## Executed results

| Layer | Result | Scope |
| --- | --- | --- |
| Structural / JavaScript syntax checks | **70/70 passed** | Source syntax, local asset/import paths, ARIA references, required documents |
| Node unit and real local HTTP tests | **57/57 passed** | Existing core helpers, mocks and development-server responses |
| Isolated UI-layout regression | **96/96 passed** | Actual markup/CSS, fixed trusted document, actual menu/dialog/splitter utilities |
| Actual hosted-browser suite | **Attempted; 0 checks passed** | Local HTTP navigation blocked by managed browser policy |
| Renderer dependency download / full converter E2E | **Not completed in this revision** | Production pins and application pipeline unchanged |
| Remote CI / Pages; Safari / Firefox; physical phones | **Not run** | Manual release gates remain |

The 2.0.0 functional component results are historical and are not counted as newly rerun 2.0.1 results. See [the preserved 2.0.0 report](QA-REPORT-2.0.0.md) for that scope. This document is not an accessibility-conformance certificate or a security audit.

## Evidence

- [Current structural log](qa/ui-2.0.1/structural.log)
- [Current Node tests](qa/ui-2.0.1/unit.log)
- [UI results and measurements](qa/ui-2.0.1/ui-layout-results.json)
- [UI execution log](qa/ui-2.0.1/ui-layout.log)
- [Hosted-browser attempted run](qa/ui-2.0.1/hosted-attempt.log)
- [Hosted-browser failure details](qa/ui-2.0.1/hosted-attempt.json)

Execution environment: Node.js 22.16.0; Chromium 144.0.7559.96 in the authoring container. The managed browser reported `net::ERR_BLOCKED_BY_ADMINISTRATOR` for the localhost test URL. Policies were not disabled or bypassed.

## What the UI test does

`tests/ui_layout.py` mounts the shipped HTML and all four stylesheets into an in-memory Chromium page. It removes the CSP and module tags only in that isolated test document. The production `index.html` retains its CSP. A trusted, checked-in HTML sample stands in for a converted document; no CDN libraries or alternative renderer versions are injected.

The actual `ui.js` module supplies menu keyboard behavior, native confirmation utilities and the splitter. The harness explicitly sets view/ARIA states for CSS checks and wires settings/help triggers to native dialogs. It does **not** run the app controller, Markdown converter, Web Worker, autosave, system clipboard or export path. The checks must not be described as an end-to-end application pass.

Coverage includes 16px primary controls, at least 14px auxiliary labels, square corners/strokes, legible disabled controls, 12 text/background-token contrast calculations, page-level horizontal overflow, usable scroll-region height, desktop split extremes, menu focus/End/Escape, native dialogs, visible error banners, user root-font enlargement and mobile Help access.

Base viewports: 1920×1080, 1440×1000, 1024×768, 930×700, 800×700, 768×700, 767×844, 430×932, 390×844, 360×800, 320×568, 720×500 and 360×400. Mobile CSS states are inspected for editor, preview and source. Additional checks use a 20px root font at 390px and 320px widths. Short viewports may scroll the application vertically by design; a narrow formatting toolbar may scroll internally.

## Preserved document styling

The original ZIP's SHA-256, `document.css` SHA-256, sample-Markdown SHA-256 and Chromium canvas-style baseline are stored in `tests/fixtures/canvas-v2.0.0.json`. Current styles are compared at 1440px and 390px. All checked typography, foreground/background, padding and corner values match the original for 15 document/canvas selectors. Panel dimensions may differ because the application controls are intentionally larger.

An optional `--baseline-root` reads the original unpacked package for live comparison instead of using the recorded style baseline. `css/document.css`, used for preview and exported HTML, is byte-identical to 2.0.0.

The minimum calculated contrast among the 12 ordinary text/background-token combinations is **7.362:1**. This is a limited solid-color calculation, not a claim about all active states, native widgets, colors in user-authored documents, every icon or overall WCAG compliance.

## Screenshots

[Desktop, 1440×1000](screenshots/desktop.png) · [Mobile editor, 390×844](screenshots/mobile.png) · [Mobile preview](screenshots/mobile-preview.png) · [File menu](screenshots/file-menu.png) · [Settings](screenshots/settings.png)

These screenshots were rendered from actual application styles in the isolated layout harness with its fixed sample. They show the UI design, not a production deployment or a measured conversion speed. The historical 2.0.0 screenshots are retained with `-v2.0.0` filenames.

## Reproduce

```bash
npm run check:all
python -m pip install -r tests/requirements.txt
python -m playwright install chromium
npm run test:ui
```

Use `RMC_CHROME_PATH` or `python tests/ui_layout.py --browser <path>` for an installed browser. Full baseline comparison:

```bash
python tests/ui_layout.py --baseline-root <unpacked-RMC-2.0.0-folder>
```

For actual converter behavior, with network access and an unrestricted local browser:

```bash
npm run vendor
npm run vendor:check
npm run test:browser
```

The default archive still uses the same CDN-loaded renderer pins as 2.0.0 and is not an offline renderer bundle. Their exact downloaded bytes and full hosted behavior remain unverified here. The updated CI includes the UI check but was not executed remotely during this handoff.
