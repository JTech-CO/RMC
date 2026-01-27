import { highlightSourceCode } from './preview.js';

export function toggleViewMode(mode, previewElement, sourceViewElement, sourceCodeElement, btnPreview, btnSource) {
    if (mode === 'preview') {
        previewElement.classList.remove('hidden');
        sourceViewElement.classList.add('hidden');
        setActiveTab(btnPreview, btnSource);
    } else {
        previewElement.classList.add('hidden');
        sourceViewElement.classList.remove('hidden');
        highlightSourceCode(sourceCodeElement);
        setActiveTab(btnSource, btnPreview);
    }
}

function setActiveTab(activeBtn, inactiveBtn) {
    activeBtn.classList.remove('bg-[#0a0a0a]', 'border-t-transparent', 'text-gray-500');
    activeBtn.classList.add('bg-[#000]', 'border-t-ide-accent', 'text-white');
    inactiveBtn.classList.remove('bg-[#000]', 'border-t-ide-accent', 'text-white');
    inactiveBtn.classList.add('bg-[#0a0a0a]', 'border-t-transparent', 'text-gray-500');
}

export function showToast(message) {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toastMsg');
    msgEl.innerText = message;
    
    toast.classList.remove('translate-y-20', 'opacity-0');
    setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
}

export function updateSaveStatus(saveStatusElement, show = true) {
    if (show) {
        saveStatusElement.classList.remove('hidden');
    } else {
        saveStatusElement.classList.add('hidden');
    }
}
