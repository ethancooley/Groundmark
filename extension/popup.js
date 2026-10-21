import { nanoStatus } from "./lib/judge.js";

const READ_PAGES = { origins: ["https://*/*", "http://*/*"] };
const LABELS = {
  supported: "Supported",
  not_found: "Not in source",
  contradicted: "Contradicted",
  unverifiable: "Couldn't check",
};
const $ = (id) => document.getElementById(id);

function renderTally(t) {
  const box = $("tab");
  if (!t || !t.total) return;
  box.replaceChildren();
  const score = document.createElement("p");
  score.className = "score";
  score.textContent = t.pending ? `Checking ${t.total} sentences…` : `${t.supported} of ${t.total} supported`;
  const bars = document.createElement("div");
  bars.className = "bars";
  bars.setAttribute("aria-hidden", "true");
  const list = document.createElement("ul");
  list.className = "legend";
  for (const v of Object.keys(LABELS)) {
    if (t[v]) {
      const seg = document.createElement("span");
      seg.className = `v-${v}`;
      seg.style.width = `${(t[v] / t.total) * 100}%`;
      bars.append(seg);
    }
    const li = document.createElement("li");
    const dot = document.createElement("span");
    dot.className = `dot v-${v}`;
    li.append(dot, `${t[v] || 0} ${LABELS[v].toLowerCase()}`);
    list.append(li);
  }
  box.append(score, bars, list);
}

async function renderStatus() {
  const canRead = await chrome.permissions.contains(READ_PAGES);
  const model = await nanoStatus(globalThis.LanguageModel);
  $("readStatus").textContent = canRead ? "Allowed" : "Not allowed yet";
  $("readStatus").className = canRead ? "ok" : "warn";
  const modelText = {
    available: "Ready: Gemini Nano",
    downloadable: "Not downloaded yet: lite mode for now",
    downloading: "Downloading: lite mode for now",
    unavailable: "Not supported here: lite mode",
    unsupported: "Not supported here: lite mode",
  }[model];
  const { engine } = await chrome.storage.sync.get({ engine: "auto" });
  $("modelStatus").textContent = engine === "lite" ? "Off: lite mode chosen in settings" : modelText;
  $("modelStatus").className = model === "available" && engine !== "lite" ? "ok" : "warn";
}

(async () => {
  const { autoRun } = await chrome.storage.sync.get({ autoRun: true });
  $("autoRun").checked = autoRun;
  $("autoRun").addEventListener("change", (e) => chrome.storage.sync.set({ autoRun: e.target.checked }));
  // Each status row opens the settings page at its section.
  document.querySelectorAll(".status-row").forEach((row) =>
    row.addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL(`setup.html#${row.dataset.section}`) });
      window.close();
    }),
  );
  renderStatus();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== undefined) {
    const key = `tab:${tab.id}`;
    const stored = await chrome.storage.session.get(key);
    renderTally(stored[key]);
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "session" && changes[key]) renderTally(changes[key].newValue);
    });
  }
})();
