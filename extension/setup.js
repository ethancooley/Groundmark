import { LANGUAGE_OPTIONS, nanoStatus } from "./lib/judge.js";

const READ_PAGES = { origins: ["https://*/*", "http://*/*"] };
const $ = (id) => document.getElementById(id);

let canRead = false;
let modelState = "checking";

function refreshDone() {
  // Setup is complete once pages can be read. The model is a bonus: without it, lite mode runs.
  const modelSettled = ["available", "unavailable", "unsupported"].includes(modelState);
  $("done").hidden = !(canRead && modelSettled);
}

async function renderRead() {
  canRead = await chrome.permissions.contains(READ_PAGES);
  $("step-read").classList.toggle("complete", canRead);
  $("allow").hidden = canRead;
  $("read-status").className = canRead ? "status ok" : "status";
  $("read-status").textContent = canRead ? "Allowed." : "";
  refreshDone();
}

function setModelStatus(text, kind = "") {
  $("model-status").className = `status ${kind}`;
  $("model-status").textContent = text;
}

async function renderModel() {
  modelState = await nanoStatus(globalThis.LanguageModel);
  const done = modelState === "available";
  $("step-model").classList.toggle("complete", done);
  $("download").hidden = modelState !== "downloadable";
  if (modelState === "available") setModelStatus("Ready. Verdicts will come from the on-device model.", "ok");
  else if (modelState === "downloadable") setModelStatus("This computer can run it. The download happens once, in the background.");
  else if (modelState === "downloading") {
    setModelStatus("Chrome is downloading the model. You can close this page; it keeps going.");
    $("download").hidden = false;
    $("download").textContent = "Show download progress";
  } else
    setModelStatus(
      "This computer or Chrome version can't run the on-device model. Overview Check will use lite mode instead.",
      "warn",
    );
  refreshDone();
}

$("allow").addEventListener("click", async () => {
  try {
    const granted = await chrome.permissions.request(READ_PAGES);
    if (!granted) {
      $("read-status").className = "status warn";
      $("read-status").textContent = "Not allowed. Overview Check can't check sentences until it can read the cited pages.";
    }
  } catch (e) {
    $("read-status").className = "status warn";
    $("read-status").textContent = `Chrome refused the request: ${e.message}`;
  }
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
    setModelStatus(`The download didn't finish: ${e.message}. Lite mode will be used until it does.`, "warn");
  } finally {
    $("download").disabled = false;
  }
  renderModel();
});

chrome.permissions.onAdded.addListener(renderRead);
chrome.permissions.onRemoved.addListener(renderRead);
renderRead();
renderModel();
