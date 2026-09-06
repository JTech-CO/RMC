"""CSS-only Chromium regression checks for RMC application chrome.

No CDN or rendering-library fixture is used. Actual markup/CSS and ui.js are
mounted in memory with a fixed trusted document. CSP is absent only in this
isolated test page. Main controller, worker, renderer, storage and exports are
NOT exercised here. Use tests/browser.py for hosted application tests.

Usage: python tests/ui_layout.py --browser /usr/bin/chromium
Optional: --baseline-root /path/to/unpacked/RMC-2.0.0 (canvas-style comparison)
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = (ROOT / 'tests/fixtures/ui-document.html').read_text(encoding='utf-8')
CANVAS = ['#editor', '#preview', '#preview h1', '#preview h2', '#preview p',
          '#preview pre', '#preview pre code', '#preview th', '#preview td',
          '#preview blockquote', '#preview input', '#sourceContainer pre',
          '#previewContainer', '#sourceContainer', '.editor-surface']
# Spatial dimensions of panes change intentionally. These typography/color metrics must not.
PROPERTIES = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
              'color', 'backgroundColor', 'borderRadius', 'padding', 'caretColor']


def sample_markdown(root: Path) -> str:
    return json.loads(subprocess.check_output(
        ['node', '--input-type=module', '-e',
         'import {DEFAULT_MARKDOWN} from "./js/config.js"; console.log(JSON.stringify(DEFAULT_MARKDOWN));'],
        cwd=root, text=True))


def mount(page, root: Path, activate_ui=True):
    html = (root / 'index.html').read_text(encoding='utf-8')
    html = re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>', '', html)
    html = re.sub(r'<link\b[^>]*>', '', html)
    html = re.sub(r'<script\b[^>]*>[\s\S]*?</script>', '', html)
    page.set_content(html)
    for name in ('styles', 'editor', 'document', 'preview'):
        page.add_style_tag(content=(root / f'css/{name}.css').read_text(encoding='utf-8'))
    md = sample_markdown(root)
    page.evaluate('''({md, fixture}) => {
      document.querySelector('#editor').value = md;
      document.querySelector('#editor').setSelectionRange(0, 0);
      document.querySelector('#editor').scrollTop = 0;
      document.querySelector('#preview').innerHTML = fixture;
      document.querySelector('#sourceCode').textContent = fixture;
      document.querySelector('#saveStatus').textContent = 'Sample · not saved';
      document.querySelector('#renderStatus').textContent = 'Preview ready';
      document.querySelector('#charCount').textContent = Array.from(md).length;
      document.querySelector('#totalLines').textContent = md.split('\\n').length;
    }''', {'md': md, 'fixture': FIXTURE})
    if activate_ui:
        source = (root / 'js/ui.js').read_text(encoding='utf-8')
        source = re.sub(r'\bexport\s+(?=(?:async\s+)?function\b)', '', source)
        page.add_script_tag(content=source + '''
          bindMenus();
          bindSplitter(document.querySelector('#workspace'), document.querySelector('#splitter'));
          document.querySelector('[data-action="settings"]').addEventListener('click', () => document.querySelector('#settingsDialog').showModal());
          document.querySelectorAll('[data-action="help"]').forEach(button => button.addEventListener('click', () => document.querySelector('#helpDialog').showModal()));
        ''')


def styles(page):
    return page.evaluate('''({selectors, properties}) => Object.fromEntries(selectors.map(selector => {
      const style = getComputedStyle(document.querySelector(selector));
      return [selector, Object.fromEntries(properties.map(name => [name, style[name]]))];
    }))''', {'selectors': CANVAS, 'properties': PROPERTIES})


def show_view(page, name):
    """Set CSS/ARIA state explicitly. Does NOT claim to test main.js navigation."""
    page.evaluate('''name => {
      const source = name === 'source';
      document.querySelector('#workspace').dataset.mobile = name;
      document.querySelector('#previewContainer').hidden = source;
      document.querySelector('#sourceContainer').hidden = !source;
      document.querySelectorAll('[data-mobile]').forEach(b => {
        if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', String(b.dataset.mobile === name));
      });
      document.querySelector('#previewTab').setAttribute('aria-selected', String(!source));
      document.querySelector('#sourceTab').setAttribute('aria-selected', String(source));
    }''', name)


def rgb_tuple(hex_color):
    return [int(hex_color[i:i+2], 16) / 255 for i in (1, 3, 5)]


def contrast(a, b):
    def luminance(color):
        channels = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in rgb_tuple(color)]
        return sum(v * weight for v, weight in zip(channels, (.2126, .7152, .0722)))
    l1, l2 = sorted((luminance(a), luminance(b)), reverse=True)
    return (l1 + .05) / (l2 + .05)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', default=os.environ.get('RMC_CHROME_PATH'))
    parser.add_argument('--out', type=Path, default=ROOT / '.test-results/ui-layout')
    parser.add_argument('--baseline-root', type=Path)
    options = parser.parse_args()
    options.out.mkdir(parents=True, exist_ok=True)
    results, failures, measurements, ratios = [], [], {}, []

    def check(name, condition, details=None):
        item = {'name': name, 'passed': bool(condition)}
        if details is not None:
            item['details'] = details
        results.append(item)
        print(('PASS' if condition else 'FAIL'), name)
        if not condition:
            failures.append(item)

    baseline = options.baseline_root
    snapshot = json.loads((ROOT / 'tests/fixtures/canvas-v2.0.0.json').read_text(encoding='utf-8'))
    if baseline:
        check('Document/export stylesheet is byte-identical to 2.0.0',
              (ROOT / 'css/document.css').read_bytes() == (baseline / 'css/document.css').read_bytes())
        check('Default Markdown content is unchanged', sample_markdown(ROOT) == sample_markdown(baseline))
    else:
        check('Document/export stylesheet is byte-identical to 2.0.0',
              hashlib.sha256((ROOT / 'css/document.css').read_bytes()).hexdigest() == snapshot['document_css_sha256'])
        check('Default Markdown content is unchanged',
              hashlib.sha256(sample_markdown(ROOT).encode()).hexdigest() == snapshot['default_markdown_sha256'])
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=options.browser, headless=True)
        version = browser.version
        page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        mount(page, ROOT)
        check('Desktop UI body uses a 16px base', page.locator('body').evaluate('(e)=>getComputedStyle(e).fontSize') == '16px')
        sizes = {s: page.locator(s).first.evaluate('(e)=>getComputedStyle(e).fontSize') for s in (
            '.menu-trigger', '.button', '.menu-panel button', '#filename', '.save-status',
            '.view-tabs button', '.pane-footer', '.status-bar', '.brand-description', '.format-hint')}
        measurements['ui_font_sizes'] = sizes
        check('Main controls are 16px; auxiliary chrome is at least 14px', all(float(x[:-2]) >= 14 for x in sizes.values()), sizes)
        check('All application frame/control corners are square', page.evaluate('''() => [...document.querySelectorAll('.pane,.button,.icon-button,.menu-trigger,.menu-panel,dialog,.brand-icon,#filename,.format-bar button')].every(e=>getComputedStyle(e).borderRadius==='0px')'''))
        check('Control icons use square-ended/miter strokes', page.locator('.icon-button svg').first.evaluate('(e)=>getComputedStyle(e).strokeLinecap === "square" && getComputedStyle(e).strokeLinejoin === "miter"'))
        check('Disabled controls remain legible, without opacity fading', page.evaluate('''() => {const b=document.querySelector('.file-actions .primary');b.disabled=true;const s=getComputedStyle(b);const ok=s.opacity==='1' && s.borderStyle==='dashed';b.disabled=false;return ok;}'''))

        # Every defined ordinary text token has a deliberately high contrast against the
        # most-used solid UI backgrounds. This is not a whole-product accessibility claim.
        colors = page.evaluate('''() => {const s=getComputedStyle(document.documentElement); return Object.fromEntries(['text','muted','subtle','panel','toolbar','surface','active'].map(k=>[k,s.getPropertyValue('--ui-'+k).trim()]));}''')
        for fg in ('text', 'muted', 'subtle'):
            for bg in ('panel', 'toolbar', 'surface', 'active'):
                ratio = contrast(colors[fg], colors[bg])
                ratios.append({'foreground': fg, 'background': bg, 'ratio': round(ratio, 3)})
                check(f'UI contrast {fg}/{bg} >= 7:1', ratio >= 7, round(ratio, 3))
        measurements['token_contrasts'] = ratios
        measurements['canvas_styles'] = {}
        # Cover desktop/tablet boundary, mobile, narrow screens and short-height reflow.
        viewports = [(1920,1080),(1440,1000),(1024,768),(930,700),(800,700),(768,700),
                     (767,844),(430,932),(390,844),(360,800),(320,568),(720,500),(360,400)]
        for width, height in viewports:
            page.set_viewport_size({'width':width, 'height':height})
            for view in ('editor','preview','source') if width < 768 else ('preview',):
                show_view(page, view)
                overflow = page.evaluate('document.documentElement.scrollWidth > innerWidth')
                check(f'No horizontal page overflow {width}x{height} / {view}', not overflow)
                pane = '#editor' if view == 'editor' and width < 768 else '#sourceContainer' if view == 'source' else '#previewContainer'
                check(f'Visible workspace retains editing area {width}x{height} / {view}',
                      page.locator(pane).bounding_box()['height'] >= 48)
            if width in (1440, 390):
                current = styles(page)
                if baseline:
                    old = browser.new_page(viewport={'width':width, 'height':height})
                    mount(old, baseline, activate_ui=False)
                    previous = styles(old)
                    old.close()
                else:
                    previous = snapshot['styles'][str(width)]
                # Inactive/hidden panels still have styles. Only visibility differs.
                differences = {s: {p:[previous[s][p],current[s][p]] for p in PROPERTIES if previous[s][p] != current[s][p]}
                               for s in CANVAS if previous[s] != current[s]}
                measurements['canvas_styles'][str(width)] = {'unchanged':not differences,'differences':differences}
                check(f'Document and canvas computed typography/colors unchanged at {width}px', not differences, differences)

        # Real ui.js keyboard behavior; hidden mobile-only menu entries must be skipped.
        page.set_viewport_size({'width':1440,'height':1000})
        show_view(page, 'preview')
        page.locator('[data-menu="file"]').click()
        page.keyboard.press('End')
        check('Desktop End skips the hidden mobile Help item', page.evaluate('document.activeElement.dataset.action === "restore"'))
        page.keyboard.press('Escape')
        check('Escape restores File trigger focus', page.locator('[data-menu="file"]').evaluate('(e)=>e===document.activeElement'))
        page.locator('#splitter').focus()
        page.keyboard.press('ArrowLeft')
        check('Existing keyboard splitter still adjusts width', page.locator('#splitter').get_attribute('aria-valuenow')=='48')
        page.keyboard.press('Home')
        check('Existing splitter Home reset remains available', page.locator('#splitter').get_attribute('aria-valuenow')=='50')

        page.locator('[data-action="settings"]').click()
        check('Settings dialog uses 16px body text and square border', page.locator('#settingsDialog').evaluate('(e)=>getComputedStyle(e).borderRadius==="0px" && getComputedStyle(e).fontSize==="16px"'))
        page.screenshot(path=str(options.out/'settings.png'))
        page.keyboard.press('Escape')
        page.locator('[data-menu="file"]').click()
        check('File menu is fully inside desktop viewport', page.locator('#fileMenu').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}'))
        page.screenshot(path=str(options.out/'file-menu.png'))
        page.keyboard.press('Escape')
        page.locator('#editor').focus()
        page.locator('#editor').blur()
        page.locator('#editor').evaluate('(e)=>{e.setSelectionRange(0,0);e.scrollTop=0;}')
        page.screenshot(path=str(options.out/'desktop.png'))

        # Splitter extrema at smaller desktop widths must not clip active tabs.
        page.set_viewport_size({'width':1024,'height':768})
        for percentage in (25,75):
            page.locator('#workspace').evaluate('(e,p)=>e.style.setProperty("--editor-width",p+"%")', percentage)
            check(f'Desktop {percentage}% split does not overflow the page', page.evaluate('document.documentElement.scrollWidth===innerWidth'))
            check(f'Desktop {percentage}% split tab controls fit panel', page.locator('.view-tabs').evaluate('(e)=>e.scrollWidth<=e.clientWidth'))
        page.locator('#workspace').evaluate('(e)=>e.style.setProperty("--editor-width","50%")')

        page.set_viewport_size({'width':390,'height':844})
        show_view(page,'editor')
        page.screenshot(path=str(options.out/'mobile.png'))
        show_view(page,'preview')
        page.screenshot(path=str(options.out/'mobile-preview.png'))
        page.locator('[data-menu="file"]').click()
        page.keyboard.press('End')
        check('Mobile Help is reachable as the last File-menu action', page.evaluate('document.activeElement.dataset.action === "help"'))
        page.keyboard.press('Enter')
        check('Mobile Help opens the native dialog', page.locator('#helpDialog').is_visible())
        page.keyboard.press('Escape')
        # Narrow dialogs/popovers, warnings and long status text.
        page.set_viewport_size({'width':320,'height':568})
        for menu in ('file','edit'):
            page.locator(f'[data-menu="{menu}"]').click()
            check(f'{menu.title()} menu fits a 320px viewport', page.locator(f'#{menu}Menu').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}'))
            page.keyboard.press('Escape')
        page.locator('[data-action="settings"]').click()
        check('320px settings dialog fits without horizontal overflow', page.locator('#settingsDialog').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&e.scrollWidth<=e.clientWidth;}'))
        page.keyboard.press('Escape')
        page.evaluate('''() => { document.querySelector('#conflictBanner').hidden=false; document.querySelector('#storageBanner').hidden=false; }''')
        check('Visible error banners do not introduce horizontal overflow at 320px', page.evaluate('document.documentElement.scrollWidth===innerWidth'))
        page.evaluate('''() => { document.querySelector('#conflictBanner').hidden=true; document.querySelector('#storageBanner').hidden=true; }''')
        # User default-font enlargement: UI uses rem; canvas stays on its existing px metrics.
        page.set_viewport_size({'width':390,'height':844})
        page.add_style_tag(content='html {font-size:20px;}')
        check('User root font preference enlarges menu labels to 20px', page.locator('.menu-trigger').first.evaluate('(e)=>getComputedStyle(e).fontSize==="20px"'))
        check('Larger root font does not cause horizontal page overflow', page.evaluate('document.documentElement.scrollWidth===innerWidth'))
        page.set_viewport_size({'width':320,'height':568})
        check('320px viewport supports a larger 20px root font without horizontal overflow', page.evaluate('document.documentElement.scrollWidth===innerWidth'))
        for menu in ('file', 'edit'):
            page.locator(f'[data-menu="{menu}"]').click()
            check(f'{menu.title()} menu fits at 320px with a 20px root font', page.locator(f'#{menu}Menu').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}'))
            page.keyboard.press('Escape')
        browser.close()
    output = {'scope':'CSS-only UI layout; fixed document fixture; actual ui.js menu/splitter utilities. Not hosted converter E2E.',
              'browser':version,'passed':len(results)-len(failures),'total':len(results),'failures':failures,
              'checks':results,'measurements':measurements}
    (options.out/'results.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'{output["passed"]}/{output["total"]} UI-layout checks passed.')
    return 1 if failures else 0

if __name__ == '__main__':
    raise SystemExit(main())
