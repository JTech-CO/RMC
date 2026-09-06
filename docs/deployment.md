# Static deployment — RMC 2.0.2

RMC is still an HTML/CSS/JavaScript static application. No backend, Vite build, Node service or npm installation is required on GitHub Pages. `npm run dev` is only a localhost development helper.

## Upgrade an existing repository first

Read [UPGRADE-KR.md](../UPGRADE-KR.md). An overlay of a ZIP does **not** remove obsolete 1.x files. The inspected repository retained `js/preview.js`, which imports a missing `sourceFormatter.js`; CI failed independently of the successful Pages deployment.

```sh
npm run migrate                 # dry run
npm run migrate -- --apply      # back up only recognized, unchanged legacy files outside the web root
npm run check:all
```

Review the Git diff before committing. Never remove `.git/`, a custom `CNAME`, personal configuration or browser draft storage. A modified legacy file is left untouched for manual review.

## Branch deployment (no custom build required)

Place `index.html`, `.nojekyll`, `release.json`, `css/`, `js/`, `assets/` and the existing `vendor/` folder at the repository root. Keep the included hidden files. Select **Settings → Pages → Build and deployment → Deploy from a branch → main → /(root)**. Do not put another RMC directory inside the publishing root. Do not select `/docs`, which contains project documentation, not the application entry point.

Wait for the Pages deployment to succeed, then reload the published site. This package does not change any repository settings or publish a remote release automatically.

## Cache-aware assets

The entry CSS/scripts, local ES-module imports, classic Worker URL and document-style fetch all carry the same `?v=2.0.2` query. Updating just `main.js` in HTML is not sufficient: its imported modules have independent URLs. Do not remove these query strings. They create a different cache key after an upgrade; they do not bypass access restrictions or repair a missing server file.

After intentionally editing application assets, increment the package version for a release and run `npm run release:stamp`. Commit the updated references and `release.json` together. Keep LF line endings; `.gitattributes` preserves deterministic file hashes on checkout.

A classic boot watchdog checks the UI stylesheet version and the app initialization marker. It does not read, modify or erase drafts. A renderer-library error remains a renderer error, not a false application-startup failure. If the watchdog itself cannot load, it cannot display its warning. Intrinsic SVG dimensions prevent oversized icons even without the full stylesheet.

## Read-only deployed-file verification

```sh
npm run check:deployment -- https://jtech-co.github.io/RMC/
```

This fetches the exact versioned runtime URLs and compares their bytes against the local release manifest. It reports HTTP errors, incorrect MIME types, old HTML, missing JS and mismatched CSS bytes. It does **not** execute the browser application or download external renderer dependencies. A `200` alone does not establish that the body is the expected stylesheet.

Chrome troubleshooting: open Developer Tools → Network, enable **Disable cache**, reload, then inspect the stylesheet response and failed requests. Try **Ctrl+Shift+R** (Windows/Linux) or **Cmd+Shift+R** (macOS). Do not use **Clear site data** as a default fix: the local draft is stored in LocalStorage. A private window can test a fresh browser state without deleting the existing one.

The screenshot from the reported incident is consistent with the new HTML receiving old/incomplete CSS. The authoring environment could not retrieve that browser's actual HTTP responses, so cache mixing is a leading hypothesis, not a confirmed root cause.

## Optional self-hosted dependencies / Actions

The default mode remains CDN, with the same explicit library pins as 2.0.1. This hotfix does not claim the pinned CDN responses have been downloaded or validated. Run `npm run vendor && npm run vendor:check` in an environment with network access to prepare local dependency files and licenses; successful vendoring also regenerates `release.json`. Commit `vendor/`, `js/runtime-urls.js` and `release.json` together.

The optional **Deploy Pages (manual)** workflow is only for repositories intentionally configured with Source=GitHub Actions. It packages the runtime files and the release marker. A branch-deployed site does not need this workflow. CI and the automatic branch Pages workflow are separate; a green Pages upload is not proof that tests or browser rendering passed.

## Local project-subpath check

```sh
BASE_PATH=/RMC/ npm run dev
npm run check:deployment -- http://127.0.0.1:8000/RMC/
```

PowerShell:

```powershell
$env:BASE_PATH = '/RMC/'
npm.cmd run dev
```

Open a second terminal for the verification command. The built-in server binds only to localhost; GitHub Pages does not run it.

## Evidence and sources

See [QA-REPORT.md](QA-REPORT.md) for exact executed checks and blocked hosted-browser tests.

- GitHub Pages static hosting: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- Publishing sources: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- HTTP caching and versioned URLs: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching
- Chrome network/cache tools: https://developer.chrome.com/docs/devtools/network/reference
- Inspected Pages run: https://github.com/JTech-CO/RMC/actions/runs/34020108949
- Inspected failed CI run: https://github.com/JTech-CO/RMC/actions/runs/34020109395
