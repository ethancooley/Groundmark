// Service worker: connects Google pages to the checker running in the
// offscreen document. Nothing here talks to any server.

export const READ_PAGES = { origins: ["https://*/*", "http://*/*"] };

let creating = null;
async function ensureOffscreen() {
  const existing = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  if (existing.length > 0) return;
  if (!creating) {
    creating = chrome.offscreen
      .createDocument({
        url: "offscreen.html",
        reasons: ["DOM_PARSER"],
        justification: "Reads the pages an AI Overview cites and checks its sentences with the on-device model.",
      })
      .finally(() => (creating = null));
  }
  await creating;
}

const jobs = new Map(); // jobId -> port

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "ocx") return;
  const mine = new Set();
  port.onDisconnect.addListener(() => {
    for (const id of mine) jobs.delete(id);
  });
  port.onMessage.addListener(async (msg) => {
    if (msg?.type !== "check" || !Array.isArray(msg.claims)) return;
    if (!(await chrome.permissions.contains(READ_PAGES))) {
      port.postMessage({ type: "setup", reason: "permission" });
      return;
    }
    try {
      await ensureOffscreen();
    } catch (e) {
      console.error(e);
      port.postMessage({ type: "error", message: "Overview Check couldn't start its checker. Reload the page to try again." });
      return;
    }
    const jobId = crypto.randomUUID();
    jobs.set(jobId, port);
    mine.add(jobId);
    chrome.runtime.sendMessage({ target: "offscreen", type: "check", jobId, claims: msg.claims }).catch(() => {
      port.postMessage({ type: "error", message: "Overview Check couldn't reach its checker. Reload the page to try again." });
    });
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.target === "background") {
    const port = jobs.get(msg.jobId);
    if (port) {
      try {
        port.postMessage(msg.event);
      } catch {
        jobs.delete(msg.jobId);
      }
      if (msg.event.type === "done" || msg.event.type === "error") jobs.delete(msg.jobId);
    }
    return false;
  }
  if (msg?.type === "tally" && sender.tab?.id !== undefined) {
    chrome.storage.session.set({ [`tab:${sender.tab.id}`]: msg.tally });
    return false;
  }
  if (msg?.type === "open_setup") {
    chrome.tabs.create({ url: chrome.runtime.getURL("setup.html") });
    return false;
  }
  if (msg?.type === "settings") {
    chrome.storage.sync.get({ autoRun: true }).then(sendResponse);
    return true;
  }
  return false;
});

// Once the user allows reading pages, tell open Google tabs to try again.
chrome.permissions.onAdded.addListener(async () => {
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) if (t.id !== undefined) chrome.tabs.sendMessage(t.id, { type: "ocx_retry" }).catch(() => {});
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") chrome.tabs.create({ url: chrome.runtime.getURL("setup.html") });
});

chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove(`tab:${tabId}`));
