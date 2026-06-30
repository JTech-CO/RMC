const childProcess = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const chromePath = findBrowserExecutable();

if (!chromePath) {
    console.error('No Chrome or Edge executable found. Set RMC_CHROME_PATH to run E2E checks.');
    process.exit(1);
}

main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
});

async function main() {
    const appServer = await createStaticServer(rootDir);
    const appPort = appServer.address().port;
    const debugPort = await getFreePort();
    const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rmc-e2e-'));
    const chrome = launchBrowser(chromePath, debugPort, profileDir);

    try {
        await waitForDevTools(debugPort);

        const appUrl = `http://127.0.0.1:${appPort}/index.html`;
        const target = await openTarget(debugPort, appUrl);
        const cdp = await CdpClient.connect(target.webSocketDebuggerUrl);

        try {
            await cdp.send('Runtime.enable');
            await cdp.send('Page.enable');
            await waitForAppReady(cdp);

            const result = await runSmokeFlow(cdp);
            console.log('E2E smoke passed.');
            console.log(JSON.stringify(result, null, 2));
        } finally {
            cdp.close();
        }
    } finally {
        await terminateBrowser(chrome);
        await closeServer(appServer);
        await removeDirectory(profileDir);
    }
}

function launchBrowser(executablePath, debugPort, profileDir) {
    return childProcess.spawn(executablePath, [
        '--headless=new',
        `--remote-debugging-port=${debugPort}`,
        `--user-data-dir=${profileDir}`,
        '--disable-background-networking',
        '--disable-gpu',
        '--no-default-browser-check',
        '--no-first-run',
        'about:blank',
    ], {
        stdio: 'ignore',
    });
}

async function createStaticServer(directory) {
    const server = http.createServer((request, response) => {
        const requestUrl = new URL(request.url, 'http://127.0.0.1');
        const pathname = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
        const normalizedPath = path.normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
        const filePath = path.join(directory, normalizedPath);

        if (!filePath.startsWith(directory)) {
            response.writeHead(403);
            response.end('Forbidden');
            return;
        }

        fs.readFile(filePath, (error, content) => {
            if (error) {
                response.writeHead(404);
                response.end('Not found');
                return;
            }

            response.writeHead(200, {
                'Cache-Control': 'no-store',
                'Content-Type': getContentType(filePath),
            });
            response.end(content);
        });
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    return server;
}

async function closeServer(server) {
    await new Promise((resolve) => server.close(resolve));
}

async function terminateBrowser(browserProcess) {
    if (browserProcess.exitCode !== null) return;

    browserProcess.kill();

    await Promise.race([
        new Promise((resolve) => browserProcess.once('exit', resolve)),
        new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
}

async function removeDirectory(directory) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
            fs.rmSync(directory, { recursive: true, force: true });
            return;
        } catch (error) {
            if (attempt === 7) throw error;
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    }
}

function getContentType(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    const contentTypes = {
        '.css': 'text/css; charset=utf-8',
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.md': 'text/markdown; charset=utf-8',
    };

    return contentTypes[extension] || 'application/octet-stream';
}

async function getFreePort() {
    const server = http.createServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    await new Promise((resolve) => server.close(resolve));
    return port;
}

async function waitForDevTools(debugPort) {
    await waitUntil(async () => {
        try {
            const version = await fetchJson(`http://127.0.0.1:${debugPort}/json/version`);
            return Boolean(version.webSocketDebuggerUrl);
        } catch {
            return false;
        }
    }, 10000, 'Chrome DevTools endpoint did not start');
}

async function openTarget(debugPort, appUrl) {
    const newTargetUrl = `http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(appUrl)}`;
    let response = await fetch(newTargetUrl, { method: 'PUT' });

    if (!response.ok) {
        response = await fetch(newTargetUrl);
    }

    if (!response.ok) {
        throw new Error(`Unable to open Chrome target: HTTP ${response.status}`);
    }

    const target = await response.json();
    if (!target.webSocketDebuggerUrl) {
        throw new Error('Chrome target did not expose a WebSocket URL');
    }

    return target;
}

async function waitForAppReady(cdp) {
    await waitUntil(async () => {
        const ready = await evaluate(cdp, `Boolean(
            document.readyState === 'complete'
            && window.marked
            && window.DOMPurify
            && window.hljs
            && document.getElementById('editor')
            && document.getElementById('previewContainer')?.innerHTML.length
        )`);
        return ready === true;
    }, 15000, 'R.M.C. app did not become ready');
}

async function runSmokeFlow(cdp) {
    return evaluate(cdp, `(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const assert = (condition, message) => {
            if (!condition) throw new Error(message);
        };
        const editor = document.getElementById('editor');
        const preview = document.getElementById('previewContainer');
        const source = document.getElementById('sourceCode');
        const sourceContainer = document.getElementById('sourceContainer');
        const dialog = document.getElementById('confirmDialog');

        localStorage.clear();
        editor.value = '# M5 Smoke\\n\\n<script>alert("x")</script>\\n\\n**safe**\\n\\n- first item\\n- **second item**';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        await wait(150);

        assert(preview.innerHTML.includes('<strong>safe</strong>'), 'Preview did not render strong text');
        assert(!preview.querySelector('script'), 'Sanitized preview still contains script tag');

        document.querySelector('[data-menu-trigger="file"]').click();
        assert(!document.querySelector('[data-menu-panel="file"]').classList.contains('hidden'), 'File menu did not open');

        document.querySelector('[data-action="new-document"]').click();
        assert(!dialog.classList.contains('hidden'), 'New document confirmation did not open');
        assert(editor.value.includes('# M5 Smoke'), 'Editor changed before confirmation');

        document.querySelector('[data-dialog-action="cancel"]').click();
        assert(dialog.classList.contains('hidden'), 'Cancel did not close confirmation');
        assert(editor.value.includes('# M5 Smoke'), 'Cancel lost editor content');

        document.querySelector('[data-action="new-document"]').click();
        document.querySelector('[data-dialog-action="confirm-new-document"]').click();
        await wait(150);

        assert(editor.value === '', 'Confirmed new document did not clear editor');
        const backup = JSON.parse(localStorage.getItem('rmc_content_backup'));
        assert(backup.content.includes('# M5 Smoke'), 'Previous document was not backed up');

        document.querySelector('[data-action="restore-backup"]').click();
        await wait(150);
        assert(editor.value.includes('# M5 Smoke'), 'Backup restore did not restore editor content');

        editor.focus();
        editor.setRangeText('\\n\\n', editor.value.length, editor.value.length, 'end');
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        await wait(150);
        editor.setSelectionRange(editor.value.length, editor.value.length);
        document.querySelector('[data-action="insert-bold"]').click();
        await wait(150);
        assert(editor.value.includes('**bold text**'), 'Bold action did not insert placeholder');

        document.getElementById('btnSource').click();
        await wait(150);

        assert(!sourceContainer.classList.contains('hidden'), 'Source view did not become visible');
        assert(source.textContent.includes('\\n'), 'Source output has no line breaks');
        assert(source.textContent.includes('\\n  <'), 'Source output has no indentation');
        assert(source.textContent.includes('<strong>bold text</strong>'), 'Source output missed inserted bold HTML');

        return {
            editorLength: editor.value.length,
            previewLength: preview.innerHTML.length,
            sourceLength: source.textContent.length,
            backupSavedAt: backup.savedAt,
        };
    })()`);
}

async function evaluate(cdp, expression) {
    const response = await cdp.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
    });

    if (response.exceptionDetails) {
        const exceptionText = response.exceptionDetails.exception?.description
            || response.exceptionDetails.text
            || 'Runtime.evaluate failed';
        throw new Error(exceptionText);
    }

    return response.result.value;
}

async function waitUntil(predicate, timeoutMs, timeoutMessage) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        if (await predicate()) {
            return;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(timeoutMessage);
}

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return response.json();
}

function findBrowserExecutable() {
    const candidates = [
        process.env.RMC_CHROME_PATH,
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/microsoft-edge',
    ].filter(Boolean);

    return candidates.find((candidate) => fs.existsSync(candidate));
}

class CdpClient {
    constructor(webSocket) {
        this.webSocket = webSocket;
        this.nextId = 1;
        this.pending = new Map();

        webSocket.addEventListener('message', (event) => {
            const message = JSON.parse(event.data);
            if (!message.id) return;

            const pendingRequest = this.pending.get(message.id);
            if (!pendingRequest) return;

            this.pending.delete(message.id);

            if (message.error) {
                pendingRequest.reject(new Error(message.error.message));
            } else {
                pendingRequest.resolve(message.result);
            }
        });
    }

    static async connect(webSocketUrl) {
        const webSocket = new WebSocket(webSocketUrl);
        await new Promise((resolve, reject) => {
            webSocket.addEventListener('open', resolve, { once: true });
            webSocket.addEventListener('error', reject, { once: true });
        });
        return new CdpClient(webSocket);
    }

    send(method, params = {}) {
        const id = this.nextId++;
        const payload = { id, method, params };

        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.webSocket.send(JSON.stringify(payload));
        });
    }

    close() {
        this.webSocket.close();
    }
}
