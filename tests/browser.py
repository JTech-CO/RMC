"""Hosted-browser smoke suite: actual ES modules, CSP, workers, storage and downloads.
This runner never replaces dependencies or browser APIs. A failed network load fails the suite.
Install: python -m pip install -r tests/requirements.txt
         python -m playwright install chromium
Run:     python tests/browser.py [--base-url http://127.0.0.1:8000] [--browser /path/to/chrome]
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
import urllib.request
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.test-results'

def main() -> int:
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument('--base-url', help='Use an existing HTTP server instead of starting one.')
    args.add_argument('--browser', default=os.environ.get('RMC_CHROME_PATH'))
    options = args.parse_args()
    server = None
    OUT.mkdir(exist_ok=True)
    passed, failures, page_errors = [], [], []
    started = time.strftime('%Y-%m-%dT%H:%M:%S%z')
    browser_version = None
    try:
        base = options.base_url
        if not base:
            with socket.socket() as sock:
                sock.bind(('127.0.0.1', 0))
                port = sock.getsockname()[1]
            base = f'http://127.0.0.1:{port}'
            server = subprocess.Popen(['node', 'scripts/serve.mjs'], cwd=ROOT,
                                      env={**os.environ, 'PORT': str(port)},
                                      stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            for _ in range(60):
                if server.poll() is not None:
                    raise RuntimeError(server.stderr.read().decode(errors='replace'))
                try:
                    with urllib.request.urlopen(base, timeout=1) as response:
                        if response.status == 200:
                            break
                except OSError:
                    time.sleep(0.1)
            else:
                raise RuntimeError('The development server did not become ready.')
        with sync_playwright() as pw:
            launch = {'headless': True}
            if options.browser:
                launch['executable_path'] = options.browser
            browser = pw.chromium.launch(**launch)
            browser_version = browser.version
            context = browser.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
            page = context.new_page()
            page.on('pageerror', lambda error: page_errors.append(str(error)))
            page.goto(base, wait_until='domcontentloaded')
            # Loading HTML is not enough: assert that the current release's CSS actually applies.
            page.wait_for_function("""() => {
                const html = document.documentElement;
                const applied = getComputedStyle(html).getPropertyValue('--rmc-ui-version')
                    .trim().replaceAll('"', '').replaceAll("'", '');
                return applied === html.dataset.rmcVersion
                    && getComputedStyle(document.body).display === 'flex'
                    && getComputedStyle(document.querySelector('#workspace')).display === 'grid';
            }""", timeout=15000)
            passed.append('Actual stylesheet release and flex/grid layout applied')
            # Do not count a plaintext fallback or renderer error as a successful startup.
            page.wait_for_function("document.querySelector('#renderStatus').textContent.startsWith('Updated')", timeout=30000)
            expect(page.locator('#preview h1')).to_be_visible()
            passed.append('Actual hosted renderer startup')
            assert len(page.workers) == 1, 'Expected a real Markdown worker'
            passed.append('Actual Web Worker created')
            # Wait for the optional highlighter rather than accepting a missing CDN script.
            page.wait_for_function('globalThis.hljs && globalThis.hljs.highlight', timeout=15000)
            passed.append('Configured syntax highlighter loaded')
            page.screenshot(path=str(OUT / 'desktop.png'), full_page=True)
            markdown = '# 한글과 Unicode 🐾\n\n```javascript\n  const n = 2;\n    console.log(n);\n```\n'
            page.locator('#editor').fill(markdown)
            expect(page.locator('#preview h1')).to_have_text('한글과 Unicode 🐾')
            assert page.locator('#preview pre code').text_content() == '  const n = 2;\n    console.log(n);\n'
            page.wait_for_function("JSON.parse(localStorage.getItem('rmc_document_v2') || '{}').content === " + json.dumps(markdown))
            passed.extend(['UTF-8 / Unicode render', 'Code whitespace preservation', 'Real localStorage autosave'])
            page.reload(wait_until='domcontentloaded')
            page.wait_for_function("document.querySelector('#renderStatus').textContent.startsWith('Updated')", timeout=30000)
            expect(page.locator('#editor')).to_have_value(markdown)
            passed.append('Draft survives real reload')
            page.locator('#sourceTab').click()
            assert page.locator('#sourceCode').text_content() == page.locator('#preview').inner_html()
            passed.append('HTML source equals sanitized preview')
            page.locator('#previewTab').click()
            with page.expect_download() as event:
                page.locator('.file-actions [data-action="export-html"]').click()
            download = event.value
            destination = OUT / 'exported.html'
            download.save_as(destination)
            exported = destination.read_text(encoding='utf-8')
            assert '<script' not in exported and 'Content-Security-Policy' in exported and '<!doctype html>' in exported.lower()
            assert page.locator('#preview').inner_html() in exported
            passed.append('Actual HTML download contains current sanitized fragment')
            with page.expect_download() as event:
                page.locator('.file-actions [data-action="export-md"]').click()
            event.value.save_as(OUT / 'exported.md')
            assert (OUT / 'exported.md').read_text(encoding='utf-8') == markdown
            passed.append('Actual Markdown download preserves source')
            page.locator('[data-menu="file"]').click()
            page.locator('#fileMenu [data-action="new"]').click()
            expect(page.locator('#dialogCancel')).to_be_focused()
            page.locator('#dialogCancel').click()
            expect(page.locator('#editor')).to_have_value(markdown)
            page.locator('[data-menu="file"]').click()
            page.locator('#fileMenu [data-action="new"]').click()
            page.locator('#dialogConfirm').click()
            expect(page.locator('#editor')).to_have_value('')
            page.reload(wait_until='domcontentloaded')
            expect(page.locator('#editor')).to_have_value('')
            passed.append('Cancel protection and persistent empty draft')
            page.locator('[data-menu="file"]').click()
            page.locator('#fileMenu [data-action="restore"]').click()
            expect(page.locator('#editor')).to_have_value(markdown)
            passed.append('Previous-document recovery')
            page.locator('#fileInput').set_input_files({'name':'import.md','mimeType':'text/markdown','buffer':b'\xef\xbb\xbf# Imported\r\n\r\nText'})
            expect(page.locator('#confirmDialog')).to_be_visible()
            page.locator('#dialogConfirm').click()
            expect(page.locator('#filename')).to_have_value('import.md')
            expect(page.locator('#preview h1')).to_have_text('Imported')
            passed.append('Actual UTF-8 file import')
            attack = '# Input test\n\n<script>globalThis.rmcInjection=1</script>\n<img src="https://example.invalid/track.png" onerror="globalThis.rmcInjection=1">\n\n[bad](javascript:alert(1))\n\n- [x] task\n'
            page.locator('#editor').fill(attack)
            expect(page.locator('#preview h1')).to_have_text('Input test')
            assert page.locator('#preview script,#preview iframe,#preview [onerror],#preview img,#preview a[href]').count() == 0
            assert page.evaluate('globalThis.rmcInjection === undefined')
            expect(page.locator('#preview input')).to_be_disabled()
            passed.append('Active HTML, dangerous links and remote images removed')
            page.locator('#editor').fill('x' * 300001)
            expect(page.locator('#renderStatus')).to_have_text('Preview unavailable', timeout=10000)
            expect(page.locator('.file-actions [data-action="export-html"]')).to_be_disabled()
            expect(page.locator('.file-actions [data-action="export-md"]')).to_be_enabled()
            passed.append('Real worker size limit fails closed')
            # Cross-tab events: no API stubs, both tabs share the same real origin.
            page.locator('#editor').fill('# Before conflict')
            expect(page.locator('#saveStatus')).to_have_text('Saved locally')
            other = context.new_page()
            other.goto(base, wait_until='domcontentloaded')
            other.locator('#editor').fill('# Other tab')
            expect(other.locator('#saveStatus')).to_have_text('Saved locally')
            expect(page.locator('#conflictBanner')).to_be_visible()
            expect(page.locator('#editor')).to_have_value('# Before conflict')
            passed.append('Actual cross-tab storage event pauses autosave')
            mobile = browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
            phone = mobile.new_page()
            phone.goto(base, wait_until='domcontentloaded')
            phone.wait_for_function("document.querySelector('#renderStatus').textContent.startsWith('Updated')", timeout=30000)
            expect(phone.locator('.editor-pane')).to_be_visible()
            phone.locator('button[data-mobile="preview"]').click()
            expect(phone.locator('.output-pane')).to_be_visible()
            assert phone.evaluate('document.documentElement.scrollWidth === innerWidth')
            phone.screenshot(path=str(OUT / 'mobile.png'), full_page=True)
            passed.append('Actual mobile navigation and overflow check')
            assert not page_errors, page_errors
            passed.append('No uncaught page errors')
            browser.close()
    except Exception as error:
        failures.append(f'{type(error).__name__}: {error}')
        print('FAIL:', failures[-1], file=sys.stderr)
        print('No dependency fixtures or policy bypasses were used. Check CDN access, browser policy and HTTP serving. '
              'For a self-hosted dependency run, first execute npm run vendor.', file=sys.stderr)
    finally:
        if server and server.poll() is None:
            server.terminate()
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()
        report = {'startedAt':started, 'mode':'actual hosted browser', 'browser':browser_version,
                  'passed':passed, 'failures':failures, 'pageErrors':page_errors}
        (OUT / 'browser-results.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'{len(passed)} hosted-browser checks passed; {len(failures)} failure(s).')
    return 1 if failures else 0

if __name__ == '__main__':
    raise SystemExit(main())
