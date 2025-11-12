// popup.js
(async function () {
  const toggle = document.getElementById('toggle');
  const siteInfo = document.getElementById('siteInfo');

  // Need `tabs` permission in manifest
  const [{ enabled = true, pausedHosts = [] }, [tab]] = await Promise.all([
    chrome.storage.sync.get({ enabled: true, pausedHosts: [] }),
    chrome.tabs.query({ active: true, currentWindow: true })
  ]);

  const host = tab?.url ? new URL(tab.url).hostname : null;

  toggle.textContent = enabled ? 'Disable globally' : 'Enable globally';
  siteInfo.textContent = host
    ? (pausedHosts.includes(host) ? `Paused on ${host}` : `Active on ${host}`)
    : '';

  toggle.addEventListener('click', async () => {
    const next = !enabled;
    await chrome.storage.sync.set({ enabled: next });
    window.close();
  });
})();
