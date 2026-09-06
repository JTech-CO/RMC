export function toast(message) {
  const node = document.getElementById('toast');
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { node.hidden = true; }, 4500);
}
export function bindMenus() {
  const triggers = [...document.querySelectorAll('[data-menu]')];
  function close(restore = false) {
    triggers.forEach(trigger => {
      if (trigger.getAttribute('aria-expanded') === 'true' && restore) trigger.focus();
      trigger.setAttribute('aria-expanded', 'false');
      document.getElementById(trigger.getAttribute('aria-controls')).hidden = true;
    });
  }
  triggers.forEach(trigger => {
    const panel = document.getElementById(trigger.getAttribute('aria-controls'));
    const enabledItems = () => [...panel.querySelectorAll('[role="menuitem"]')].filter(item => !item.disabled && item.getClientRects().length > 0);
    const open = () => { close(); trigger.setAttribute('aria-expanded', 'true'); panel.hidden = false; enabledItems()[0]?.focus(); };
    trigger.addEventListener('click', event => { event.stopPropagation(); trigger.getAttribute('aria-expanded') === 'true' ? close(true) : open(); });
    trigger.addEventListener('keydown', event => { if (event.key === 'ArrowDown') { event.preventDefault(); open(); } });
    panel.addEventListener('keydown', event => {
      const items = enabledItems();
      const index = items.indexOf(document.activeElement);
      if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      }
      if (event.key === 'Escape') { event.preventDefault(); close(true); }
      if (event.key === 'Tab') close();
    });
  });
  document.addEventListener('click', () => close());
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(true); });
  return close;
}
export function askConfirmation(title, message, label = 'Continue') {
  const dialog = document.getElementById('confirmDialog');
  document.getElementById('dialogTitle').textContent = title;
  document.getElementById('dialogText').textContent = message;
  document.getElementById('dialogConfirm').textContent = label;
  const previous = document.activeElement;
  return new Promise(resolve => {
    dialog.returnValue = '';
    dialog.addEventListener('close', () => { previous?.focus({ preventScroll: true }); resolve(dialog.returnValue === 'confirm'); }, { once: true });
    dialog.showModal();
    document.getElementById('dialogCancel').focus();
  });
}
export function bindSplitter(workspace, splitter) {
  let start = false;
  const set = percentage => {
    const value = Math.max(25, Math.min(75, percentage));
    workspace.style.setProperty('--editor-width', `${value}%`);
    splitter.setAttribute('aria-valuenow', String(Math.round(value)));
  };
  splitter.addEventListener('pointerdown', event => { start = true; splitter.setPointerCapture(event.pointerId); workspace.classList.add('resizing'); });
  splitter.addEventListener('pointermove', event => {
    if (!start) return;
    const bounds = workspace.getBoundingClientRect(); set((event.clientX - bounds.left) / bounds.width * 100);
  });
  const stop = () => { start = false; workspace.classList.remove('resizing'); };
  splitter.addEventListener('pointerup', stop); splitter.addEventListener('pointercancel', stop);
  splitter.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); set(Number(splitter.getAttribute('aria-valuenow')) + (event.key === 'ArrowLeft' ? -2 : 2)); }
    if (event.key === 'Home') { event.preventDefault(); set(50); }
  });
  splitter.addEventListener('dblclick', () => set(50));
}
