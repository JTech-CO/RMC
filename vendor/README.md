# Optional locally hosted dependencies

This directory intentionally contains **no downloaded renderer bundles** in the handoff ZIP. The source defaults to exact CDN URLs in `js/runtime-urls.js`.

Run `npm run vendor` with Node.js 22+ and outbound HTTPS to fetch Marked 18.0.11, DOMPurify 3.4.14 and highlight.js 11.12.0 plus their license notices. The script validates basic response shape/version, writes files and a SHA-256 manifest, then switches the runtime to local relative URLs. It does not fetch fonts or silently choose older versions.

Run `npm run vendor:check` after downloading to compare the local files against their recorded hashes. This detects subsequent accidental changes against the manifest, **not** a malicious or incorrect original download from an upstream host. Review source locations, version banners and licenses before committing. CDN mode does not use SRI hashes because verified asset bytes were not available when this package was authored. Self-hosted assets remove runtime CDN execution dependence after a reviewed download.

Commit this directory and the generated `js/runtime-urls.js` together. Keep the licenses and manifest in deployed or distributed copies of the vendored bundles. Marked uses MIT, DOMPurify offers its upstream dual license, and highlight.js uses BSD-3-Clause; the fetched license files are authoritative for the exact versions.

A failed download may leave partial assets here, but the CDN runtime configuration is not switched until every download completes. On a failure, inspect the message and retry from a clean working tree. The script's files are not an npm package dependency graph, so `npm audit` does not audit the CDN/vendored runtime. Follow upstream security releases separately.
