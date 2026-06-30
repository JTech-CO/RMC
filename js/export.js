import { showToast } from './ui.js';

export function downloadHTML(htmlContent) {
    const bodyContent = htmlContent ?? '';
    const content = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Document</title>
<style>
    body { font-family: sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 2rem; color: #111; }
    pre { background: #f4f4f4; padding: 1rem; border-radius: 0; overflow-x: auto; }
    blockquote { border-left: 4px solid #000; margin: 0; padding-left: 1rem; color: #555; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 1rem; }
    th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
</style>
</head>
<body>
${bodyContent}
</body>
</html>`;
    downloadFile('document.html', content, 'text/html');
}

export function downloadMarkdown(markdownText) {
    downloadFile('document.md', markdownText ?? '', 'text/markdown');
}

function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported: ${filename}`);
}

export async function copyToClipboard(content, successMessage = 'Copied to clipboard') {
    const copyContent = content ?? '';
    
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(copyContent);
            showToast(successMessage);
            return true;
        } catch (err) {
            console.warn('Clipboard API failed, falling back to textarea copy.', err);
        }
    }

    const textarea = document.createElement('textarea');
    textarea.value = copyContent;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
        document.execCommand('copy');
        showToast(successMessage);
        return true;
    } catch (err) {
        console.error('Copy failed', err);
        showToast("Copy failed: Permission denied");
        return false;
    } finally {
        document.body.removeChild(textarea);
    }
}
