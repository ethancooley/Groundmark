import { createChecker } from "../lib/checker.js";

const READ_PAGES = { origins: ["https://*/*", "http://*/*"] };
const LABELS = ["supported", "not_found", "contradicted", "unverifiable"];
const $ = (id) => document.getElementById(id);
let lastReport = null;

function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

async function loadCases() {
  const res = await fetch(chrome.runtime.getURL("eval/cases.json"));
  const rows = await res.json();
  $("cases").value = rows.map((r) => JSON.stringify(r)).join("\n");
}

function parseCases() {
  return $("cases")
    .value.split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l, i) => {
      const row = JSON.parse(l);
      if (!row.claim || !row.url || !LABELS.slice(0, 3).includes(row.expected)) throw new Error(`Line ${i + 1} needs claim, url, and expected.`);
      return { id: `case-${i + 1}`, ...row };
    });
}

function render(cases, results, mode, ms) {
  const matrix = Object.fromEntries(LABELS.map((e) => [e, Object.fromEntries(LABELS.map((g) => [g, 0]))]));
  let scored = 0;
  let correct = 0;
  for (const c of cases) {
    const got = results[c.id]?.verdict ?? "unverifiable";
    matrix[c.expected][got]++;
    if (got !== "unverifiable") {
      scored++;
      if (got === c.expected) correct++;
    }
  }
  const flagged = LABELS.reduce((s, e) => s + matrix[e].contradicted, 0);
  const report = $("report");
  report.replaceChildren();

  const summary = el("div", undefined, "summary");
  const stat = (label, value) => {
    const s = el("div", undefined, "stat");
    s.append(el("b", value), el("span", label));
    summary.append(s);
  };
  stat("accuracy on readable pages", scored ? `${((100 * correct) / scored).toFixed(1)}%` : "n/a");
  stat("cases scored", `${correct}/${scored}`);
  stat("contradicted precision", flagged ? `${((100 * matrix.contradicted.contradicted) / flagged).toFixed(0)}%` : "n/a");
  stat("checker", mode === "model" ? "Gemini Nano" : "Lite mode");
  stat("unreadable pages", String(cases.length - scored));
  stat("time", `${(ms / 1000).toFixed(1)}s`);
  report.append(summary);

  const m = el("table", undefined, "matrix");
  const head = el("tr");
  head.append(el("th", "Expected \\ Got"), ...LABELS.map((l) => el("th", l)));
  m.append(head);
  for (const e of LABELS.slice(0, 3)) {
    const tr = el("tr");
    tr.append(el("th", e), ...LABELS.map((g) => el("td", String(matrix[e][g]), e === g ? "ok" : "")));
    m.append(tr);
  }
  report.append(el("h2", "Confusion matrix"), m);

  const t = el("table");
  const th = el("tr");
  th.append(...["", "Claim", "Expected", "Got", "Explanation and quote"].map((h) => el("th", h)));
  t.append(th);
  for (const c of cases) {
    const r = results[c.id];
    const got = r?.verdict ?? "unverifiable";
    const tr = el("tr");
    const okCell = got === "unverifiable" ? el("td", "–") : got === c.expected ? el("td", "✓", "ok") : el("td", "✗", "bad");
    const claim = el("td");
    claim.append(el("div", c.claim));
    const link = el("a", new URL(c.url).hostname);
    link.href = c.url;
    link.target = "_blank";
    claim.append(link);
    const detail = el("td");
    detail.append(el("div", r?.explanation ?? ""));
    if (r?.evidence?.quote) detail.append(el("div", r.evidence.quote, "quote"));
    tr.append(okCell, claim, el("td", c.expected), el("td", got), detail);
    t.append(tr);
  }
  report.append(el("h2", "Cases"), t);

  lastReport = { ranAt: new Date().toISOString(), mode, correct, scored, matrix, cases: cases.map((c) => ({ ...c, result: results[c.id] })) };
  $("save").disabled = false;
}

$("run").addEventListener("click", async () => {
  if (!(await chrome.permissions.contains(READ_PAGES))) {
    $("allow").hidden = false;
    $("status").textContent = "Allow reading pages first.";
    return;
  }
  let cases;
  try {
    cases = parseCases();
  } catch (e) {
    $("status").textContent = e.message;
    return;
  }
  $("run").disabled = true;
  const checker = createChecker({ fetch: (...a) => fetch(...a), DOMParser, LanguageModel: globalThis.LanguageModel });
  const results = {};
  let mode = "heuristic";
  const started = performance.now();
  let done = 0;
  await checker.run(
    cases.map((c) => ({ id: c.id, text: c.claim, sources: [c.url] })),
    (ev) => {
      if (ev.type === "start") mode = ev.mode;
      if (ev.type === "result") {
        results[ev.result.id] = ev.result;
        $("status").textContent = `Checked ${++done} of ${cases.length}…`;
      }
    },
  );
  $("status").textContent = "Done.";
  $("run").disabled = false;
  render(cases, results, mode, performance.now() - started);
});

$("allow").addEventListener("click", async () => {
  if (await chrome.permissions.request(READ_PAGES)) {
    $("allow").hidden = true;
    $("status").textContent = "Allowed. Run the evaluation.";
  }
});

$("save").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: "application/json" });
  const a = el("a");
  a.href = URL.createObjectURL(blob);
  a.download = `groundmark-eval-${lastReport.ranAt.slice(0, 19).replace(/[:T]/g, "-")}.json`;
  a.click();
});

loadCases();
