let isConfigured = false;

export function convertMarkdownToHtml(markdownText) {
    ensureMarkdownRuntime();
    configureMarked();

    const rawHtml = globalThis.marked.parse(markdownText ?? '');
    return globalThis.DOMPurify.sanitize(rawHtml);
}

function ensureMarkdownRuntime() {
    const hasMarked = Boolean(globalThis.marked && typeof globalThis.marked.parse === 'function');
    const hasDomPurify = Boolean(globalThis.DOMPurify && typeof globalThis.DOMPurify.sanitize === 'function');

    if (!hasMarked || !hasDomPurify) {
        throw new Error('Markdown libraries are not loaded. Check CDN access for marked and DOMPurify.');
    }
}

function configureMarked() {
    if (isConfigured) return;

    globalThis.marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: false,
    });

    isConfigured = true;
}
