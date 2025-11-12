// popup.js - AI AutoCorrect popup controls
(async function () {
  const toggle = document.getElementById('toggle');
  const siteInfo = document.getElementById('siteInfo');
  const modeOptions = document.querySelectorAll('.mode-option');
  const modeRadios = document.querySelectorAll('input[name="mode"]');

  // Load current settings
  const [settings, [tab]] = await Promise.all([
    chrome.storage.sync.get({ enabled: true, mode: 'auto', pausedHosts: [] }),
    chrome.tabs.query({ active: true, currentWindow: true })
  ]);

  const { enabled, mode, pausedHosts } = settings;
  const host = tab?.url ? new URL(tab.url).hostname : null;

  // Set up mode selection
  const currentMode = mode || 'auto';
  const currentRadio = document.querySelector(`input[value="${currentMode}"]`);
  if (currentRadio) {
    currentRadio.checked = true;
    currentRadio.closest('.mode-option').classList.add('selected');
  }

  // Update mode selection UI
  modeOptions.forEach(option => {
    option.addEventListener('click', function() {
      const radio = this.querySelector('input[type="radio"]');
      radio.checked = true;

      // Update visual selection
      modeOptions.forEach(opt => opt.classList.remove('selected'));
      this.classList.add('selected');

      // Save mode
      const selectedMode = radio.value;
      chrome.storage.sync.set({ mode: selectedMode });
      updateStatusMessage(enabled, selectedMode, host, pausedHosts);
    });
  });

  // Set up global enable/disable toggle
  toggle.textContent = enabled ? 'Disable Globally' : 'Enable Globally';

  toggle.addEventListener('click', async () => {
    const next = !enabled;
    await chrome.storage.sync.set({ enabled: next });
    window.close();
  });

  // Update status message
  function updateStatusMessage(isEnabled, currentMode, hostname, paused) {
    siteInfo.className = 'status';

    if (!isEnabled) {
      siteInfo.textContent = '⭕ Disabled globally';
      siteInfo.classList.add('disabled');
      return;
    }

    if (hostname && paused.includes(hostname)) {
      siteInfo.textContent = `⏸️ Paused on ${hostname}`;
      siteInfo.classList.add('paused');
      return;
    }

    let modeText = '';
    switch (currentMode) {
      case 'auto':
        modeText = '✨ Auto-correcting';
        break;
      case 'suggestions':
        modeText = '💡 Showing suggestions';
        break;
      case 'off':
        modeText = '⭕ Mode: Off';
        break;
      default:
        modeText = '✅ Active';
    }

    if (hostname) {
      siteInfo.textContent = `${modeText} on ${hostname}`;
    } else {
      siteInfo.textContent = modeText;
    }

    if (currentMode === 'off') {
      siteInfo.classList.add('disabled');
    } else {
      siteInfo.classList.add('active');
    }
  }

  // Initial status update
  updateStatusMessage(enabled, currentMode, host, pausedHosts);
})();
