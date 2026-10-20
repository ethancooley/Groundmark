// Runs the checker in an offscreen document: it has the DOM parser for reading
// pages and the browser's built-in language model, which workers don't have.
import { createChecker } from "./lib/checker.js";

const checker = createChecker({
  fetch: (...args) => fetch(...args),
  DOMParser,
  LanguageModel: globalThis.LanguageModel,
});

// One on-device model, so jobs run one after another.
let queue = Promise.resolve();

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.target !== "offscreen") return false;
  if (msg.type === "check") {
    const send = (event) => chrome.runtime.sendMessage({ target: "background", jobId: msg.jobId, event }).catch(() => {});
    queue = queue
      .then(() => checker.run(msg.claims, send))
      .catch((e) => {
        console.error(e);
        send({ type: "error", message: "The checker hit an unexpected error. Reload the page to try again." });
      });
  }
  return false;
});
