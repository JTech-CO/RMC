"""Isolated deployment-watchdog checks using actual markup/styles/boot script.
No real HTTP, ESM controller, CDN, Worker, storage or renderer execution is claimed.
"""
import argparse, json, re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
def main():
    args = argparse.ArgumentParser()
    args.add_argument('--browser', default='/usr/bin/chromium')
    args.add_argument('--out', type=Path, default=ROOT/'.test-results/boot')
    options=args.parse_args(); options.out.mkdir(parents=True, exist_ok=True)
    results=[]
    def check(name, ok):
        results.append({'name':name,'passed':bool(ok)}); print(('PASS' if ok else 'FAIL'),name)
    html=(ROOT/'index.html').read_text()
    html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>', '', html)
    html=re.sub(r'<link\b[^>]*>', '', html)
    html=re.sub(r'<script\b[^>]*>[\s\S]*?</script>', '', html)
    boot=(ROOT/'js/boot.js').read_text()
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=options.browser,headless=True)
        def mount(styles=False,marker=False):
            page=browser.new_page(viewport={'width':1440,'height':1000})
            page.set_content(html)
            if styles:
                for name in ['styles','editor','document','preview']:
                    page.add_style_tag(content=(ROOT/f'css/{name}.css').read_text())
            if marker: page.evaluate('document.documentElement.dataset.rmcBoot=document.documentElement.dataset.rmcVersion')
            page.add_script_tag(content=boot)
            page.evaluate('window.dispatchEvent(new Event("load"))')
            return page
        page=mount()
        check('No CSS: deployment banner is visible',page.locator('#deploymentNotice').is_visible())
        check('No CSS: message identifies missing/outdated stylesheet','stylesheet' in page.locator('#deploymentMessage').inner_text())
        check('No CSS: symbol definitions occupy zero height',page.locator('.icon-definitions').bounding_box()['height']==0)
        check('No CSS: regular icons keep a 20px intrinsic width',page.locator('.header-actions svg').first.bounding_box()['width']==20)
        check('No CSS: warning protects draft data','Do not clear site data' in page.locator('#deploymentMessage').inner_text())
        page.close()
        page=mount(styles=True)
        check('Current CSS, failed module: banner is visible',page.locator('#deploymentNotice').is_visible())
        check('Current CSS, failed module: specific module startup message','JavaScript application did not start' in page.locator('#deploymentMessage').inner_text())
        page.close()
        page=mount(styles=True,marker=True)
        check('Current CSS and startup marker: no false warning',not page.locator('#deploymentNotice').is_visible())
        check('Current CSS: application still uses flex layout',page.locator('body').evaluate('(e)=>getComputedStyle(e).display')=='flex')
        page.add_style_tag(content=':root { --rmc-ui-version: "1.1.0"; }')
        page.evaluate('window.dispatchEvent(new Event("load"))')  # listener is once; reinject to test the stale case.
        page.add_script_tag(content=boot)
        page.evaluate('window.dispatchEvent(new Event("load"))')
        check('Old stylesheet marker is rejected even after application startup','stylesheet' in page.locator('#deploymentMessage').inner_text() and page.locator('#deploymentNotice').is_visible())
        page.close(); browser.close()
    (options.out/'results.json').write_text(json.dumps({'scope':__doc__,'checks':results,'passed':sum(x['passed'] for x in results)},indent=2))
    return 0 if all(x['passed'] for x in results) else 1
if __name__=='__main__': raise SystemExit(main())
