// Service worker: talks to the checking server on behalf of the page.
//
// The extension has no host permissions. It can't read any site except Google
// search pages, and it only sends the Overview's sentences and the links Google
// attached to them. Your search query is never sent.

importScripts("config.js");

const DEFAULTS = { apiBase: globalThis.OCX_DEFAULT_API_BASE, autoRun: true };

async function getSettings() {
  const s = await chrome.storage.sync.get(DEFAULTS);
  return { ...DEFAULTS, ...s, apiBase: String(s.apiBase || DEFAULTS.apiBase).replace(/\/+$/, "") };
}

async function streamCheck(claims, port, signal) {
  const { apiBase } = await getSettings();
  let res;
  try {
    res = await fetch(`${apiBase}/api/check`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ claims }),
      signal,
    });
  } catch {
    port.postMessage({
      type: "error",
      message: `Couldn't reach the checking server at ${apiBase}. Check the server address in the extension's popup.`,
    });
    return;
  }

  if (!res.ok || !res.body) {
    let message = `The checking server returned an error (${res.status}).`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {}
    port.postMessage({ type: "error", message });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        port.postMessage(JSON.parse(line));
      } catch {}
    }
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "ocx") return;
  const controller = new AbortController();
  port.onDisconnect.addListener(() => controller.abort());
  port.onMessage.addListener(async (msg) => {
    if (msg?.type !== "check" || !Array.isArray(msg.claims)) return;
    try {
      await streamCheck(msg.claims, port, controller.signal);
    } catch (e) {
      if (!controller.signal.aborted) {
        try {
          port.postMessage({ type: "error", message: "The connection to the checking server dropped. Try again." });
        } catch {}
      }
    }
  });
});

// The page reports its tally so the popup can show it.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "tally" && sender.tab?.id !== undefined) {
    chrome.storage.session.set({ [`tab:${sender.tab.id}`]: msg.tally });
  }
  if (msg?.type === "settings") {
    getSettings().then(sendResponse);
    return true;
  }
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove(`tab:${tabId}`));
