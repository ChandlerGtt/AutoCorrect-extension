
const DEFAULTS = { enabled: true, pausedHosts: [] };

chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.sync.get(DEFAULTS);
  await chrome.storage.sync.set({ ...DEFAULTS, ...cur });
  await setBadge(cur.enabled ?? true);
  await buildMenus();
});

chrome.storage.onChanged.addListener(async (changes) => {
  if (changes.enabled) await setBadge(changes.enabled.newValue);
});

async function setBadge(enabled) {
  await chrome.action.setBadgeText({ text: enabled ? "" : "OFF" });
  await chrome.action.setBadgeBackgroundColor({ color: "#777" });
}

async function buildMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "toggle-site",
      title: "Pause/Resume on this site",
      contexts: ["action"]
    });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "toggle-site" || !tab?.url) return;
  const host = new URL(tab.url).hostname;
  const { pausedHosts = [] } = await chrome.storage.sync.get(["pausedHosts"]);
  const set = new Set(pausedHosts);
  set.has(host) ? set.delete(host) : set.add(host);
  await chrome.storage.sync.set({ pausedHosts: Array.from(set) });

  // brief visual confirmation
  await chrome.action.setBadgeText({ text: set.has(host) ? "PAU" : "" });
  setTimeout(async () => {
    const { enabled = true } = await chrome.storage.sync.get("enabled");
    await setBadge(enabled);
  }, 800);
});
