"""Offline component harness. It does NOT test hosted CSP, real workers, downloads or storage.
Pass a directory containing real JS fixtures (marked.js, purify.js, highlight.js).
Production smoke tests are in browser.py; see docs/QA-REPORT.md for the distinction.
"""
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]

def build_bundle():
    factories = []
    for file in sorted((ROOT / 'js').glob('*.js')):
        if file.name == 'markdown.worker.js':
            continue
        source = file.read_text(encoding='utf-8')
        exports = re.findall(r'export\s+(?:async\s+)?(?:const|class|function)\s+(\w+)', source)
        def replace_import(match):
            names, ref = match.group(1), match.group(2)
            target = (file.parent / ref).resolve().relative_to(ROOT).as_posix()
            return f'const {{{names}}} = require({json.dumps(target)});'
        source = re.sub(r'import\s*\{([\s\S]*?)\}\s*from\s*[\'"]([^\'"]+)[\'"];', replace_import, source)
        source = re.sub(r'\bexport\s+(?=(?:async\s+)?(?:const|class|function)\b)', '', source)
        source = source.replace('import.meta.url', json.dumps('https://rmc.invalid/js/' + file.name))
        factories.append(json.dumps(file.relative_to(ROOT).as_posix()) + ': function(require){\n' + source + '\nreturn {' + ','.join(exports) + '};\n}')
    return '(function(){const factories={' + ','.join(factories) + '};const cache={};function require(id){return cache[id]||(cache[id]=factories[id](require));}globalThis.__rmcRequire=require;require("js/main.js");})();'

def mount(page, fixtures, initial=None):
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    html = re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>', '', html)
    html = re.sub(r'<link\b[^>]*>', '', html)
    html = re.sub(r'<script\b[^>]*>[\s\S]*?</script>', '', html)
    page.set_content(html)
    for name in ['styles','editor','document','preview']:
        page.add_style_tag(content=(ROOT / 'css' / (name + '.css')).read_text(encoding='utf-8'))
    for name in ['marked','purify','highlight']:
        page.add_script_tag(content=(Path(fixtures) / (name + '.js')).read_text(encoding='utf-8'))
    worker_source = (ROOT / 'js' / 'markdown.worker.js').read_text(encoding='utf-8')
    page.evaluate('''({initial,styles,workerSource}) => {
      const values = new Map(Object.entries(initial || {}));
      globalThis.__storageValues = values;
      Object.defineProperty(globalThis, 'localStorage', { configurable:true, value: {
        getItem:key=>values.has(key)?values.get(key):null,
        setItem:(key,value)=>values.set(key,String(value)), removeItem:key=>values.delete(key)
      }});
      globalThis.fetch = async () => new Response(styles, {status:200});
      globalThis.__downloads=[];
      const blobs = new Map();let blobId=0;
      URL.createObjectURL = blob => {const id='blob:rmc/'+(++blobId);blobs.set(id,blob);return id;};
      URL.revokeObjectURL = id => blobs.delete(id);
      const nativeClick=HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click=function(){
        if(this.download){const data={name:this.download,text:null};globalThis.__downloads.push(data);blobs.get(this.href)?.text().then(text=>data.text=text);}
        else nativeClick.call(this);
      };
      globalThis.Worker=class {
        constructor(){
          this.listeners={};this.terminated=false;this.incoming=null;
          const owner=this;
          const scope={ addEventListener(type,listener){if(type==='message')owner.incoming=listener;},
            postMessage(data){setTimeout(()=>{if(!owner.terminated)(owner.listeners.message||[]).forEach(f=>f({data}));},0);} };
          new Function('self','importScripts',workerSource)(scope,()=>{scope.marked=globalThis.marked;});
        }
        addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
        postMessage(data){setTimeout(()=>{if(!this.terminated)this.incoming({data});},0);}
        terminate(){this.terminated=true;}
      };
    }''', {'initial':initial or {},'styles':(ROOT/'css/document.css').read_text(encoding='utf-8'),'workerSource':worker_source})
    page.evaluate(build_bundle())
    page.wait_for_function("document.getElementById('renderStatus').textContent.startsWith('Updated')", timeout=7000)
