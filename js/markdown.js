let isConfigured = false;

export function convertMarkdownToHtml(markdownText) {
    configureMarked();

    const rawHtml = marked.parse(markdownText ?? '');
    return DOMPurify.sanitize(rawHtml);
}

function configureMarked() {
    if (isConfigured) return;

    marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: false,
    });

    isConfigured = true;
}
