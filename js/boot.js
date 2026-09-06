/* Independent classic-script watchdog. It never reads or writes the document or storage. */
(() => {
  const expected = document.documentElement.dataset.rmcVersion;
  const show = message => {
    const notice = document.getElementById('deploymentNotice');
    const text = document.getElementById('deploymentMessage');
    if (!notice || !text) return;
    text.textContent = message;
    notice.hidden = false;
  };
  const check = () => {
    const applied = getComputedStyle(document.documentElement).getPropertyValue('--rmc-ui-version').trim().replaceAll('"', '').replaceAll("'", '');
    if (applied !== expected) {
      show(`The application stylesheet is missing or outdated (expected ${expected}). Use Ctrl+Shift+R / Cmd+Shift+R after deployment completes. Do not clear site data: it contains your draft.`);
    } else if (document.documentElement.dataset.rmcBoot !== expected) {
      show(`The JavaScript application did not start (expected ${expected}). Check failed JavaScript requests in Developer Tools → Network, or run npm run check:deployment with the site URL. Your draft has not been cleared.`);
    } else {
      document.getElementById('deploymentNotice').hidden = true;
    }
  };
  // A failed ES-module import cannot disable this independent script.
  window.addEventListener('load', check, { once: true });
  setTimeout(check, 15000);
})();
