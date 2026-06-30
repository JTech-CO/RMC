const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const failures = [];

runCheck('JSON files parse and versions match', checkJsonFiles);
runCheck('Required project files exist', checkRequiredFiles);
runCheck('Retired planning artifacts are removed', checkRetiredArtifacts);
runCheck('HTML entry point references valid files', checkHtmlReferences);
runCheck('UI contract is wired without inline handlers', checkUiContract);
runCheck('JavaScript modules parse', checkJavaScriptSyntax);
runCheck('JavaScript imports resolve', checkJavaScriptImports);
runCheck('Markdown documentation links resolve', checkMarkdownLinks);

if (failures.length > 0) {
    console.error('\nCheck failed:');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
}

console.log('\nAll checks passed.');

function runCheck(label, checkFn) {
    try {
        checkFn();
        console.log(`ok - ${label}`);
    } catch (error) {
        failures.push(`${label}: ${error.message}`);
        console.error(`fail - ${label}`);
    }
}

function checkJsonFiles() {
    const packageJson = readJson('package.json');
    const packageLock = readJson('package-lock.json');

    assert(packageJson.name === packageLock.name, 'package name mismatch');
    assert(packageJson.version === packageLock.version, 'package version mismatch');
    assert(packageJson.scripts?.check === 'node scripts/check.js', 'missing package script: check');
    assert(packageJson.scripts?.test === 'npm run check', 'missing package script: test');
}

function checkRequiredFiles() {
    [
        'index.html',
        'README.md',
        'docs/deployment.md',
        'package.json',
        'package-lock.json',
        'scripts/e2e-smoke.js',
        'css/styles.css',
        'css/scrollbar.css',
        'css/editor.css',
        'css/preview.css',
        'js/main.js',
        'js/markdown.js',
        'js/preview.js',
        'js/sourceFormatter.js',
        'js/export.js',
        'js/storage.js',
        'js/autoSave.js',
        'js/scrollSync.js',
        'js/editor.js',
        'js/ui.js',
        'js/config.js',
    ].forEach((filePath) => {
        assert(fileExists(filePath), `missing required file: ${filePath}`);
    });
}

function checkRetiredArtifacts() {
    [
        'legacy.html',
        'Real-time Markdown Converter WP.md',
    ].forEach((filePath) => {
        assert(!fileExists(filePath), `retired artifact should be removed: ${filePath}`);
    });
}

function checkHtmlReferences() {
    const html = readText('index.html');

    assert(html.includes('<script type="module" src="js/main.js"></script>'), 'missing module entry script');

    const referencedFiles = [
        ...extractHtmlAttributeValues(html, 'script', 'src'),
        ...extractHtmlAttributeValues(html, 'link', 'href'),
    ].filter((href) => isLocalReference(href));

    referencedFiles.forEach((href) => {
        assert(fileExists(href), `missing referenced file: ${href}`);
    });
}

function checkUiContract() {
    const html = readText('index.html');
    const mainJs = readText('js/main.js');
    const previewJs = readText('js/preview.js');

    assert(!html.includes('onclick='), 'index.html still contains inline onclick handlers');
    assert(!mainJs.includes('window.toggleViewMode'), 'main.js still exposes window.toggleViewMode');
    assert(!mainJs.includes('window.downloadHTML'), 'main.js still exposes window.downloadHTML');
    assert(!mainJs.includes('window.downloadMarkdown'), 'main.js still exposes window.downloadMarkdown');
    assert(!mainJs.includes('window.copyToClipboard'), 'main.js still exposes window.copyToClipboard');

    ['file', 'edit', 'view'].forEach((menuName) => {
        assert(html.includes(`data-menu-trigger="${menuName}"`), `missing ${menuName} menu trigger`);
        assert(html.includes(`data-menu-panel="${menuName}"`), `missing ${menuName} menu panel`);
    });

    [
        'new-document',
        'download-markdown',
        'download-html',
        'restore-backup',
        'insert-bold',
        'insert-italic',
        'insert-link',
        'insert-code-block',
        'copy-html',
        'focus-editor',
        'focus-preview',
    ].forEach((action) => {
        assert(html.includes(`data-action="${action}"`), `missing action button: ${action}`);
    });

    ['preview', 'source'].forEach((mode) => {
        assert(html.includes(`data-view-mode="${mode}"`), `missing view mode button: ${mode}`);
    });

    assert(html.includes('whitespace-pre'), 'source view should preserve formatter whitespace');
    assert(html.includes('data-dialog-action="confirm-new-document"'), 'missing new document confirmation action');
    assert(mainJs.includes('saveBackupToStorage'), 'main.js should back up content before clearing');
    assert(mainJs.includes('loadBackupFromStorage'), 'main.js should support backup restore');
    assert(previewJs.includes("import { formatHtmlSource } from './sourceFormatter.js';"), 'preview.js should use sourceFormatter');
}

function checkJavaScriptSyntax() {
    listFiles('js', '.js').forEach((filePath) => {
        const code = stripModuleSyntax(readText(filePath));

        try {
            new Function(code);
        } catch (error) {
            throw new Error(`${filePath}: ${error.message}`);
        }
    });
}

function stripModuleSyntax(source) {
    return source
        .replace(/import[\s\S]*?from\s+['"][^'"]+['"];?\s*/g, '')
        .replace(/^\s*import\s+['"][^'"]+['"];?\s*/gm, '')
        .replace(/\bexport\s+/g, '');
}

function checkJavaScriptImports() {
    listFiles('js', '.js').forEach((filePath) => {
        const source = readText(filePath);

        for (const match of source.matchAll(/from ['"](.+?)['"]/g)) {
            const specifier = match[1];
            if (!specifier.startsWith('.')) continue;

            const importTarget = path.normalize(path.join(path.dirname(filePath), specifier));
            assert(fileExists(importTarget), `${filePath} imports missing file: ${specifier}`);
        }
    });
}

function checkMarkdownLinks() {
    ['README.md', 'docs/deployment.md'].forEach((filePath) => {
        const markdown = readText(filePath);

        for (const match of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
            const href = match[1];
            if (href.startsWith('#') || /^[a-z]+:/i.test(href)) continue;

            const target = href.split('#')[0];
            assert(fileExists(path.join(path.dirname(filePath), target)), `${filePath} links missing file: ${href}`);
        }
    });
}

function extractHtmlAttributeValues(html, tagName, attributeName) {
    const values = [];
    const tagPattern = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
    const attributePattern = new RegExp(`${attributeName}=["']([^"']+)["']`, 'i');

    for (const tagMatch of html.matchAll(tagPattern)) {
        const attributeMatch = tagMatch[0].match(attributePattern);
        if (attributeMatch) {
            values.push(attributeMatch[1]);
        }
    }

    return values;
}

function isLocalReference(href) {
    return !href.startsWith('http://')
        && !href.startsWith('https://')
        && !href.startsWith('//')
        && !href.startsWith('#')
        && !href.startsWith('mailto:');
}

function listFiles(directory, extension) {
    const absoluteDirectory = path.join(rootDir, directory);
    return fs.readdirSync(absoluteDirectory)
        .filter((fileName) => fileName.endsWith(extension))
        .map((fileName) => path.join(directory, fileName));
}

function readJson(filePath) {
    return JSON.parse(readText(filePath));
}

function readText(filePath) {
    return fs.readFileSync(path.join(rootDir, filePath), 'utf8');
}

function fileExists(filePath) {
    return fs.existsSync(path.join(rootDir, filePath));
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}
