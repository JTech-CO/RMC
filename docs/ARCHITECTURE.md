# Architecture and maintenance notes

## Design

A build-free static application, not a framework migration. `index.html` defines accessible controls and a meta CSP; `main.js` coordinates a small state machine. Browser editing and Markdown export are initialized before renderer dependencies load. Renderer failure therefore does not disable access to the source.

```text
User input ──► editor / current revision ──► 140 ms debounce
                       │                          │
                       │                          ▼
                       │                 Parser → Web Worker → Marked
                       │                          │
                       │                          ▼
                       │                  DOMPurify + URL policy
                       │                          │
                       │                  bounded highlighting
                       │                          │
                       │                          ▼
                       │           one sanitized HTML fragment
                       │           ├─ preview
                       │           ├─ HTML source / copy
                       │           └─ HTML file + document.css
                       ▼
               500 ms save debounce
                       ▼
                  DraftStore
                  ├─ validate schema
                  ├─ detect changed stored value
                  ├─ save result / warning
                  └─ recovery slot before replacement
```

## Module responsibilities

| File | Responsibility |
| --- | --- |
| `config.js` | Example, storage keys, editor timing and import limit |
| `runtime-urls.js` | Explicit CDN or local asset locations |
| `dependencies.js` | Renderer dependency loading and URL resolution |
| `parser.js` | Worker lifecycle, request IDs, readiness and watchdog timers |
| `markdown.worker.js` | Marked conversion, input/output limits; no DOM access |
| `markdown.js` | HTML allowlist, links/images, task controls, bounded highlighting |
| `editor.js` | Selection formatting, metadata and Unicode-aware character counting |
| `storage.js` | Validated records, legacy migration, save results and backups |
| `export.js` | HTML shell, shared stylesheet, copy fallbacks and Blob downloads |
| `scroll-sync.js` | Guarded proportional two-way scrolling without feedback loops |
| `ui.js` | Menus, modal confirmations, divider, toast |
| `main.js` | State and event orchestration, imports, conflicts, revision gating |
| `utils.js` | Pure filename, URL, normalization, cursor and debounce helpers |

The application controller deliberately remains a controller rather than distributing mutable document state across many small modules. The previous `autoSave.js` and `sourceFormatter.js` are replaced by a single save state path and exact-fragment source rendering. Do not reintroduce formatting that changes `<pre>` or inline-code text.

## Rendering contracts

Only the most recent document revision may replace the visible output. HTML-related buttons are disabled immediately when the input changes. Export awaits a current successful render and rechecks the revision after fetching styles. An empty document is a valid successful render; an error is a separate `null` result. Do not conflate those states.

The parser starts in a classic same-origin worker and loads a pinned UMD Marked bundle with `importScripts`. Its startup timeout is 12 seconds; each parse has a 2.5-second watchdog. Termination clears pending requests. The renderer limits input and output, but DOMPurify/highlight still run on the main thread. Code highlighting has per-block and block-count limits and no auto-detection. Resource bounds reduce risk; they do not prove that every permitted input will complete within a strict wall-clock budget.

The preview is not a sandboxed iframe. Its boundary is DOMPurify plus a deliberately constrained tag/attribute/URL policy and CSP. Arbitrary author-provided IDs/classes/styles cannot take over application chrome. Readonly checkbox controls are rebuilt from permitted attributes. Unknown code languages display as text. Any future renderer/plugin must enter this same sanitization boundary, not write arbitrary HTML to the page.

## Storage contracts

A document record includes `schema`, `content`, `name` and `updatedAt`. `DraftStore` remembers the exact serialized value it read and compares it again before saving. A `storage` event also pauses saves. Neither provides an atomic compare-and-swap across tabs. To require strong consistency, redesign using an appropriate locking/transactional persistence strategy; do not describe this implementation as collaboration support.

Legacy raw content and old backups are read only after validation. Corrupt modern records are not overwritten by a sample document. Missing and empty documents are distinct. A backup failure prevents destructive replacement. Recovery is a single alternating previous-document slot, not a history list. LocalStorage may be unavailable or evicted; export remains the independent escape path.

## Styling

As of 2.0.1, `--ui-*` tokens are isolated from the document/canvas tokens. Primary chrome text is 1rem and secondary chrome text is .875rem (16px/14px at the default root). Application controls are square-edged, with explicit borders and neutral readable labels. Do not apply UI-wide scaling or token replacements to `.markdown-body`, the editor font or exported `document.css`. `tests/ui_layout.py` checks this separation against the recorded 2.0.0 canvas baseline.

`styles.css` owns design tokens, workspace structure and reusable controls. `editor.css` owns textarea typography and editor controls. `document.css` styles only `.markdown-body` and export-shell elements, including inline syntax colors and print rules. `preview.css` owns scroll/source/error containers. No runtime Tailwind compiler, external font or icon stylesheet is needed.

Responsive breakpoint: 768 px. Desktop divider range: 25–75%. Mobile uses a single visible pane and does not synchronize hidden panes. The app respects reduced-motion preferences and provides visible keyboard focus. These measures are not a WCAG certification; screen-reader and cross-browser manual checks remain necessary.

## Adding features

Prefer pure helpers with Node tests and a hosted-browser regression for behavior crossing DOM, storage or download boundaries. Preserve the single source-of-truth HTML result. Avoid auto-loading remote document resources, injecting raw labels as HTML, or treating a failed browser operation as success. Keep development dependencies out of the deployed runtime directory. Review dependency versions and licensing together; do not upgrade a sanitizer merely by renaming an asset.
