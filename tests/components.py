import sys,json,argparse,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tests'))
args=argparse.ArgumentParser(description='Isolated component suite; NOT hosted E2E. Supply your own compatible dependency fixtures.')
args.add_argument('--fixtures',required=True,type=Path)
args.add_argument('--browser',default=os.environ.get('RMC_CHROME_PATH'))
args.add_argument('--out',type=Path,default=ROOT/'.test-results/components')
opts=args.parse_args();opts.out.mkdir(parents=True,exist_ok=True)
from component_harness import mount
from playwright.sync_api import sync_playwright
F=opts.fixtures;results=[];errors=[]
def check(name, condition):
 if not condition:raise AssertionError(name)
 results.append(name);print('PASS',name)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=opts.browser,headless=True,args=['--no-sandbox'])
 c=b.new_context(viewport={'width':1440,'height':1000});page=c.new_page()
 page.on('pageerror',lambda e:errors.append(str(e)))
 mount(page,F)
 check('Sample heading rendered',page.locator('#preview h1').inner_text()=='A little less friction.')
 check('Code highlighting',page.locator('#preview pre code .hljs-keyword').count()>0)
 check('Desktop has no body overflow',page.evaluate('document.documentElement.scrollWidth===innerWidth && document.documentElement.scrollHeight===innerHeight'))
 page.screenshot(path=str(opts.out/'desktop.png'),full_page=True)
 page.locator('#editor').fill('# 한글 테스트 👋\n\n```text\n  first\n\n last\n```\n\nA\nB')
 page.wait_for_function("document.querySelector('#preview h1')?.textContent==='한글 테스트 👋'")
 page.wait_for_timeout(600)
 check('Local draft autosave',page.evaluate("JSON.parse(localStorage.getItem('rmc_document_v2')).content.startsWith('# 한글')"))
 check('Fenced code whitespace retained',page.locator('#preview pre code').inner_text()=='  first\n\n last\n')
 check('Soft breaks preserved',page.locator('#preview p br').count()==1)
 page.locator('#sourceTab').click()
 check('HTML source is exactly preview HTML',page.evaluate("document.getElementById('sourceCode').textContent===document.getElementById('preview').innerHTML"))
 page.locator('#previewTab').click()
 page.locator('[data-action="export-html"]').first.click() if False else None
 page.locator('.file-actions [data-action="export-html"]').click()
 page.wait_for_function("globalThis.__downloads[0]?.text !== null")
 check('HTML download prepared',page.evaluate("__downloads[0].name==='untitled.html' && __downloads[0].text.includes('한글 테스트') && !__downloads[0].text.includes('<script')"))
 page.locator('#editor').fill('<script>globalThis.pwned=1</script>\n\n<img src="https://example.org/track.png" onerror="globalThis.pwned=2">\n\n<a href="javascript:alert(1)" id="editor" name="editor" style="position:fixed">bad</a>\n\n<svg onload="alert(1)"></svg><iframe src="https://example.org"></iframe>\n\n<input type="text" value="x"><input type="checkbox" checked>')
 page.wait_for_timeout(500)
 check('Active HTML removed',page.locator('#preview script,#preview iframe,#preview svg,#preview [onerror],#preview [style],#preview [id],#preview [name]').count()==0)
 check('Dangerous URL stripped',page.locator('#preview a[href]').count()==0)
 check('Remote images blocked',page.locator('#preview img').count()==0 and page.locator('#preview .image-placeholder').count()==1)
 check('No active injected script',page.evaluate('globalThis.pwned===undefined'))
 check('Only disabled task checkbox remains',page.locator('#preview input').count()==1 and page.locator('#preview input').is_disabled())
 # Native dialog cancel + confirm + recovery.
 page.locator('[data-menu="file"]').click();page.locator('#fileMenu [data-action="new"]').click()
 check('Native confirmation opens and focuses cancel',page.locator('#confirmDialog').is_visible() and page.locator('#dialogCancel').evaluate('(e)=>e===document.activeElement'))
 before=page.locator('#editor').input_value();page.locator('#dialogCancel').click()
 check('Cancel keeps current document',page.locator('#editor').input_value()==before)
 page.locator('[data-menu="file"]').click();page.locator('#fileMenu [data-action="new"]').click();page.locator('#dialogConfirm').click();page.wait_for_timeout(250)
 check('Confirmed new document remains empty',page.locator('#editor').input_value()=='' and page.evaluate("JSON.parse(localStorage.getItem('rmc_document_v2')).content===''") )
 page.locator('[data-menu="file"]').click();page.locator('#fileMenu [data-action="restore"]').click();page.wait_for_timeout(250)
 check('Recovery restores previous document',page.locator('#editor').input_value()==before)
 # Accessible menus.
 page.locator('[data-menu="edit"]').focus();page.keyboard.press('ArrowDown')
 check('Menu opens from keyboard',page.locator('#editMenu').is_visible())
 page.keyboard.press('End');check('Menu End focuses last item',page.locator('#editMenu button').last.evaluate('(e)=>e===document.activeElement'))
 page.keyboard.press('Escape');check('Escape returns to trigger',page.locator('[data-menu="edit"]').evaluate('(e)=>e===document.activeElement'))
 # Toolbar editing.
 page.locator('#editor').fill('word');page.locator('#editor').evaluate('(e)=>e.setSelectionRange(0,4)')
 page.locator('.format-bar [data-format="bold"]').click()
 check('Selection wrapping',page.locator('#editor').input_value()=='**word**')
 page.keyboard.press('Control+z');check('Native undo for toolbar insertion',page.locator('#editor').input_value()=='word')
 # Unsupported language is readable plaintext.
 page.locator('#editor').fill('```unknown-lang\n<hello>\n```');page.wait_for_timeout(300)
 check('Unknown code language is safe text',page.locator('#preview pre code').inner_text()=='<hello>\n')
 # Divider keyboard.
 page.locator('#splitter').focus();page.keyboard.press('ArrowLeft')
 check('Keyboard splitter resizes',page.locator('#splitter').get_attribute('aria-valuenow')=='48')
 page.keyboard.press('Home');check('Splitter Home resets',page.locator('#splitter').get_attribute('aria-valuenow')=='50')
 # Denied clipboard fallback must not report success.
 page.evaluate("document.execCommand=()=>false")
 page.locator('.file-actions [data-action="copy-md"]').click();page.wait_for_timeout(150)
 check('Clipboard denial feedback',page.locator('#toast').inner_text().startswith('Copy failed.'))
 # Limit path uses actual worker source through test transport.
 page.locator('#editor').fill('x'*300001);page.wait_for_timeout(400)
 check('Oversized preview fails closed',page.locator('#renderStatus').inner_text()=='Preview unavailable' and page.locator('.file-actions [data-action="export-html"]').is_disabled())
 check('Markdown export remains enabled on renderer failure',page.locator('.file-actions [data-action="export-md"]').is_enabled())
 check('No uncaught browser errors',not errors)
 # Phone layout and screenshot.
 mc=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 m=mc.new_page();mount(m,F)
 check('Mobile editor initially visible',m.locator('.editor-pane').is_visible() and not m.locator('.output-pane').is_visible())
 m.locator('button[data-mobile="preview"]').click()
 check('Mobile preview switches correctly',m.locator('.output-pane').is_visible() and not m.locator('.editor-pane').is_visible())
 check('Mobile no horizontal body overflow',m.evaluate('document.documentElement.scrollWidth===innerWidth'))
 m.screenshot(path=str(opts.out/'mobile.png'),full_page=True)
 m.locator('button[data-mobile="source"]').click()
 check('Mobile HTML view switches correctly',m.locator('#sourceContainer').is_visible())
 # Legacy empty + storage conflict simulation are explicitly component tests.
 legacy=c.new_page();mount(legacy,F,{'rmc_content_dark':''})
 check('Legacy empty draft migration in app',legacy.locator('#editor').input_value()=='' and legacy.evaluate("JSON.parse(localStorage.getItem('rmc_document_v2')).content===''") )
 legacy.locator('#editor').fill('local edits')
 legacy.evaluate("window.dispatchEvent(new StorageEvent('storage',{key:'rmc_document_v2',newValue:'{}'}))")
 check('Storage event pauses autosave without replacing text',legacy.locator('#conflictBanner').is_visible() and legacy.locator('#editor').input_value()=='local edits')
 browser_version=b.version
 b.close()
(opts.out/'component-results.json').write_text(json.dumps({'browser':browser_version,'mode':'isolated component harness; compatibility fixtures','fixtures':'Caller-supplied files; inspect their version headers. See QA-REPORT.md for release-handoff fixture versions.','passed':results,'errors':errors},ensure_ascii=False,indent=2))
print('TOTAL',len(results))
