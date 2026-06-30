import { convertMarkdownToHtml } from './markdown.js';
import { formatHtmlSource } from './sourceFormatter.js';

export function updatePreview(markdownText, previewElement, sourceCodeElement, sourceViewElement) {
    const cleanHtml = convertMarkdownToHtml(markdownText);
    const formattedHtml = formatHtmlSource(cleanHtml);

    previewElement.innerHTML = cleanHtml;
    sourceCodeElement.textContent = formattedHtml;

    previewElement.querySelectorAll('pre code').forEach((block) => {
        highlightCodeElement(block);
    });

    if (sourceViewElement && !sourceViewElement.classList.contains('hidden')) {
        highlightSourceCode(sourceCodeElement);
    }

    return {
        html: cleanHtml,
        formattedHtml,
    };
}

export function highlightSourceCode(sourceCodeElement) {
    highlightCodeElement(sourceCodeElement);
}

function highlightCodeElement(codeElement) {
    if (!hasHighlightRuntime()) return;

    codeElement.removeAttribute('data-highlighted');
    globalThis.hljs.highlightElement(codeElement);
}

function hasHighlightRuntime() {
    return Boolean(globalThis.hljs && typeof globalThis.hljs.highlightElement === 'function');
}
