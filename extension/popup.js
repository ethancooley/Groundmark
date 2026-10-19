const DEFAULTS = { apiBase: globalThis.OCX_DEFAULT_API_BASE, autoRun: true };
const LABELS = {
  supported: "Supported",
  not_found: "Not in source",
  contradicted: "Contradicted",
  unverifiable: "Couldn't check",
};

const $ = (id) => document.getElementById(id);

async function checkServer(base) {
  const status = $("serverStatus");
  status.className = "status";
  status.textContent = "Connecting…";
  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}/api/health`, { cache: "no-store" });
    const body = await res.json();
    if (!res.ok || !body.ok) throw new Error();
    status.className = "status ok";
    status.textContent =
      body.mode === "model" ? `Connected. Checking with ${body.model}.` : "Connected in lite mode (word matching, no AI model).";
  } catch {
    status.className = "status bad";
    status.textContent = "Couldn't reach a checking server at this address.";
  }
}

function renderTally(t) {
  const box = $("tab");
  if (!t || !t.total) return;
  box.replaceChildren();
  const done = t.total - (t.pending || 0);
  const score = document.createElement("p");
  score.className = "score";
  score.textContent = t.pending ? `Checking ${t.total} sentences…` : `${t.supported} of ${t.total} supported`;
  const bars = document.createElement("div");
  bars.className = "bars";
  bars.setAttribute("aria-hidden", "true");
  const list = document.createElement("ul");
  list.className = "legend";
  for (const v of ["supported", "not_found", "contradicted", "unverifiable"]) {
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
  if (done === 0) bars.remove();
}

(async () => {
  const settings = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
  $("autoRun").checked = settings.autoRun;
  $("apiBase").value = settings.apiBase;

  $("autoRun").addEventListener("change", (e) => chrome.storage.sync.set({ autoRun: e.target.checked }));
  $("serverForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const value = $("apiBase").value.trim().replace(/\/+$/, "");
    if (!/^https?:\/\//.test(value)) {
      $("serverStatus").className = "status bad";
      $("serverStatus").textContent = "Enter an address that starts with https://";
      return;
    }
    await chrome.storage.sync.set({ apiBase: value });
    checkServer(value);
  });

  $("serverForm").closest("details").addEventListener("toggle", (e) => {
    if (e.target.open) checkServer($("apiBase").value);
  });

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
