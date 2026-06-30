let isSyncingLeftScroll = false;
let isSyncingRightScroll = false;

export function handleEditorScroll(editor, preview) {
    if (!isSyncingLeftScroll) {
        isSyncingRightScroll = true;
        syncScroll(editor, preview);
        setTimeout(() => isSyncingRightScroll = false, 50);
    }
}

export function handlePreviewScroll(editor, preview) {
    if (!isSyncingRightScroll) {
        isSyncingLeftScroll = true;
        syncScroll(preview, editor);
        setTimeout(() => isSyncingLeftScroll = false, 50);
    }
}

function syncScroll(sourceElement, targetElement) {
    const sourceMaxScroll = sourceElement.scrollHeight - sourceElement.clientHeight;
    const targetMaxScroll = targetElement.scrollHeight - targetElement.clientHeight;

    if (sourceMaxScroll <= 0 || targetMaxScroll <= 0) {
        targetElement.scrollTop = 0;
        return;
    }

    const percentage = sourceElement.scrollTop / sourceMaxScroll;
    targetElement.scrollTop = percentage * targetMaxScroll;
}
