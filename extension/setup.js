import { LANGUAGE_OPTIONS, nanoStatus } from "./lib/judge.js";

const READ_PAGES = { origins: ["https://*/*", "http://*/*"] };
const INTERNALS = "chrome://on-device-internals";
const $ = (id) => document.getElementById(id);

let canRead = false;
let modelState = "checking";
let firstRun = true;

function refreshPage() {
  // Setup is complete once pages can be read. The model is a bonus: without it, lite mode runs.
  const modelSettled = ["available", "unavailable", "unsupported"].includes(modelState);
  $("done").hidden = !(canRead && modelSettled && firstRun);
  if (!firstRun) {
    $("title").textContent = "Groundmark settings";
    $("lede").textContent = "Manage what Groundmark can read, and see the on-device AI it uses.";
    document.title = "Groundmark settings";
  }
}

async function renderRead() {
  canRead = await chrome.permissions.contains(READ_PAGES);
  $("read").classList.toggle("complete", canRead);
  $("allow").hidden = canRead;
  $("revoke").hidden = !canRead;
  $("read-status").className = canRead ? "status ok" : "status";
  $("read-status").textContent = canRead
    ? "Allowed. Groundmark checks Overviews on Google search pages."
    : "Not allowed. Groundmark can't check sentences until it can read the cited pages.";
  refreshPage();
}

function setModelStatus(text, kind = "") {
  $("model-status").className = `status ${kind}`;
  $("model-status").textContent = text;
}

async function renderModel() {
  modelState = await nanoStatus(globalThis.LanguageModel);
  $("model").classList.toggle("complete", modelState === "available");
  $("download").hidden = modelState !== "downloadable";
  if (modelState === "available") setModelStatus("Ready. Verdicts come from Gemini Nano on this computer.", "ok");
  else if (modelState === "downloadable") setModelStatus("This computer can run it. The download happens once, in the background.");
  else if (modelState === "downloading") {
    setModelStatus("Chrome is downloading the model. You can close this page; it keeps going.");
    $("download").hidden = false;
    $("download").textContent = "Show download progress";
  } else
    setModelStatus(
      "This computer or Chrome version can't run the on-device model. Groundmark uses lite mode instead.",
      "warn",
    );
  refreshPage();
}

function showModelPath() {
  const p = (navigator.userAgentData?.platform || navigator.platform || "").toLowerCase();
  let path = "Chrome's profile folder, in OptGuideOnDeviceModel";
  if (p.includes("mac")) path = "~/Library/Application Support/Google/Chrome/OptGuideOnDeviceModel";
  else if (p.includes("win")) path = "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\OptGuideOnDeviceModel";
  else if (p.includes("linux")) path = "~/.config/google-chrome/OptGuideOnDeviceModel";
  else if (p.includes("cros")) path = "Managed by ChromeOS";
  $("model-path").textContent = path;
}

$("allow").addEventListener("click", async () => {
  try {
    const granted = await chrome.permissions.request(READ_PAGES);
    if (!granted) {
      $("read-status").className = "status warn";
      $("read-status").textContent = "Not allowed. Groundmark can't check sentences until it can read the cited pages.";
      return;
    }
  } catch (e) {
    $("read-status").className = "status warn";
    $("read-status").textContent = `Chrome refused the request: ${e.message}`;
    return;
  }
  renderRead();
});

$("revoke").addEventListener("click", async () => {
  await chrome.permissions.remove(READ_PAGES);
  renderRead();
});

$("download").addEventListener("click", async () => {
  $("download").disabled = true;
  $("progress").hidden = false;
  setModelStatus("Downloading. This can take several minutes on a slow connection.");
  try {
    // A click is required to start the download; create() starts it and reports progress.
    const session = await LanguageModel.create({
      ...LANGUAGE_OPTIONS,
      monitor(m) {
        m.addEventListener("downloadprogress", (e) => {
          const pct = Math.round(e.loaded * 100);
          $("bar").style.width = `${pct}%`;
          $("pct").textContent = `${pct}%`;
        });
      },
    });
    session.destroy();
    $("progress").hidden = true;
  } catch (e) {
    setModelStatus(`The download didn't finish: ${e.message}. Lite mode is used until it does.`, "warn");
  } finally {
    $("download").disabled = false;
  }
  renderModel();
});

$("internals").addEventListener("click", async () => {
  try {
    await chrome.tabs.create({ url: INTERNALS });
  } catch {
    $("internals").hidden = true;
    $("internals-hint").hidden = false;
  }
});

$("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(INTERNALS);
    $("copy").textContent = "Copied";
  } catch {
    $("copy").textContent = "Couldn't copy";
  }
});

async function renderEngine() {
  const { engine } = await chrome.storage.sync.get({ engine: "auto" });
  for (const r of document.querySelectorAll('input[name="engine"]')) r.checked = r.value === engine;
}
for (const r of document.querySelectorAll('input[name="engine"]')) {
  r.addEventListener("change", () => r.checked && chrome.storage.sync.set({ engine: r.value }));
}

chrome.permissions.onAdded.addListener(renderRead);
chrome.permissions.onRemoved.addListener(renderRead);

(async () => {
  // A revisit (from the popup, or after setup is already done) shows the page as settings.
  const { setupSeen } = await chrome.storage.local.get({ setupSeen: false });
  firstRun = !setupSeen && !location.hash;
  if (!setupSeen) chrome.storage.local.set({ setupSeen: true });
  showModelPath();
  await Promise.all([renderRead(), renderModel(), renderEngine()]);
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView({ block: "start" });
})();
