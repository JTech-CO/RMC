# Changelog

## 2.0.1 — UI-readability handoff, 2026-09-06 (not published upstream)

### Changed

- Raised application control text to 16px and auxiliary UI text to 14px at the default root size; retained editor, preview, source and exported-document typography.
- Replaced small tracked monospace chrome labels with system sans-serif text and tabular status numerals.
- Added an isolated `--ui-*` neutral palette with bright text, explicit borders, limited selection/focus accents and legible disabled states.
- Squared buttons, panels, popovers, dialogs and the favicon; changed UI icon strokes to square caps and miter joins.
- Enlarged interaction areas; reflowed headers, narrow split panes, menus and short viewports without reducing text size.
- Kept mobile Help reachable via File; keyboard menu navigation skips CSS-hidden items.

### Preserved

- Byte-identical `css/document.css`, including exported HTML styles.
- Original sample Markdown, editor font/color, preview and HTML-source typography.
- Conversion, sanitization, storage keys, imports/exports and dependency pins.

### Verification

- 70 structural/syntax checks and 57 Node unit/HTTP tests rerun and passed.
- 96 isolated UI-layout checks passed, including baseline comparisons and 13 viewport sizes. Fixed document fixture; not converter E2E.
- Actual hosted-browser test attempted again, but navigation was blocked by browser policy before any checks passed. See `docs/QA-REPORT.md`.

## 2.0.0 — refactor handoff, 2026-09-06 (not published upstream)

Based on `JTech-CO/RMC` main tree `748248cb3401b9142f5dbef1274c2bc044011cec`, previously identified as 1.1.0.

### Changed

- Replaced Tailwind Play CDN, inline theme configuration, Font Awesome and external fonts with static CSS tokens, system fonts and local SVG symbols.
- Retained dark UI; added responsive single-pane mobile navigation, resizable desktop divider, formatting controls and explicit local-save state.
- Updated pinned renderer configuration to Marked 18.0.11, DOMPurify 3.4.14 and highlight.js 11.12.0.
- Moved Markdown parsing into a worker with request/revision protection, timeouts and size caps.
- Unified sanitized preview/source/copy/export output; removed whitespace-changing HTML pretty printing.
- Made exported HTML dark and self-styled, with light print styles and no rendering scripts.
- Changed GitHub/JTech links to normal new-tab navigation; removed temporary replacement of the current document before redirection.

### Fixed or hardened

- Clipboard fallback now checks the actual return value and restores focus.
- Failed/stale conversion cannot be exported as apparently successful empty HTML.
- Debounced autosave flushes on lifecycle changes and reports storage failures.
- Preserved empty drafts and legacy migration; invalid records are not overwritten by defaults.
- New/open/restore require successful backup/save before replacing the editor document.
- Detected cross-tab changes pause autosave instead of silently overwriting text.
- Export object URLs are released after a delay, not immediately at click time.
- Guarded scroll ratios and synchronized scrolling, unknown code languages and IME composition.
- Restricted raw HTML, images, classes/IDs, URL schemes and active controls.

### Added

- UTF-8 file import/drop, filename handling, editing shortcuts and native confirmation dialogs.
- English README plus `README-KR.md`, audit, architecture, deployment and honest QA records.
- Dependency-free Node dev/check tools; unit/HTTP tests; separate real-browser and isolated component suites.
- Optional local library vendoring with license files and integrity manifest.
- CI checks and manually triggered GitHub Pages workflow.

### Verification note

The core and isolated component tests were executed. The actual hosted browser suite was attempted but blocked by the authoring environment's browser policy. Production-pinned dependency bytes and real hosting/browser behavior remain release-gate checks; see `docs/QA-REPORT.md`.
