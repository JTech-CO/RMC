let isSyncingLeftScroll = false;
let isSyncingRightScroll = false;

export function handleEditorScroll(editor, preview) {
    if (!isSyncingLeftScroll) {
        isSyncingRightScroll = true;
        const percentage = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
        preview.scrollTop = percentage * (preview.scrollHeight - preview.clientHeight);
        setTimeout(() => isSyncingRightScroll = false, 50);
    }
}

export function handlePreviewScroll(editor, preview) {
    if (!isSyncingRightScroll) {
        isSyncingLeftScroll = true;
        const percentage = preview.scrollTop / (preview.scrollHeight - preview.clientHeight);
        editor.scrollTop = percentage * (editor.scrollHeight - editor.clientHeight);
        setTimeout(() => isSyncingLeftScroll = false, 50);
    }
}
