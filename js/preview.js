export function updatePreview(editor, previewElement, sourceCodeElement) {
    const markdownText = editor.value;
    
    marked.setOptions({ breaks: true, gfm: true, headerIds: false });
    const rawHtml = marked.parse(markdownText);
    const cleanHtml = DOMPurify.sanitize(rawHtml);

    previewElement.innerHTML = cleanHtml;
    sourceCodeElement.textContent = cleanHtml; 

    previewElement.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });
}

export function highlightSourceCode(sourceCodeElement) {
    hljs.highlightElement(sourceCodeElement);
}
