export function updateCounts(editor, charCountElement) {
    const text = editor.value;
    charCountElement.innerText = text.length.toLocaleString();
}

export function updateCursorPos(editor, lineCountElement, colCountElement) {
    const textStr = editor.value.substr(0, editor.selectionStart);
    const lines = textStr.split(/\r*\n/);
    const currentLine = lines.length;
    const currentCol = lines[lines.length - 1].length + 1;
    
    lineCountElement.innerText = currentLine;
    colCountElement.innerText = currentCol;
}
