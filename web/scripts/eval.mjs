// Measures how often the checker agrees with hand-labeled verdicts.
//
//   node scripts/eval.mjs [server] [cases.jsonl]
//   node scripts/eval.mjs http://localhost:3000 eval/cases.jsonl
//
// Each line of the cases file: {"claim": "...", "url": "...", "expected": "supported" | "not_found" | "contradicted"}
// Prints accuracy, a confusion matrix, and every disagreement so you can read why.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const server = (process.argv[2] || "http://localhost:3000").replace(/\/+$/, "");
const file = resolve(process.argv[3] || resolve(import.meta.dirname, "../eval/cases.jsonl"));
const LABELS = ["supported", "not_found", "contradicted", "unverifiable"];

const cases = readFileSync(file, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("//"))
  .map((l, i) => ({ id: `case-${i + 1}`, ...JSON.parse(l) }));

async function check(batch) {
  const res = await fetch(`${server}/api/check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ claims: batch.map((c) => ({ id: c.id, text: c.claim, sources: [c.url] })) }),
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  const results = {};
  for (const line of (await res.text()).split("\n")) {
    if (!line.trim()) continue;
    const ev = JSON.parse(line);
    if (ev.type === "result") results[ev.result.id] = ev.result;
    if (ev.type === "error") throw new Error(ev.message);
  }
  return results;
}

const results = {};
for (let i = 0; i < cases.length; i += 8) {
  Object.assign(results, await check(cases.slice(i, i + 8)));
  process.stdout.write(`\rChecked ${Math.min(i + 8, cases.length)} of ${cases.length}`);
}
console.log("\n");

const matrix = Object.fromEntries(LABELS.map((e) => [e, Object.fromEntries(LABELS.map((g) => [g, 0]))]));
const misses = [];
let scored = 0;
let correct = 0;
for (const c of cases) {
  const r = results[c.id];
  const got = r?.verdict ?? "unverifiable";
  matrix[c.expected][got]++;
  if (got === "unverifiable") continue; // couldn't read the page: not a judgment error
  scored++;
  if (got === c.expected) correct++;
  else misses.push({ ...c, got, explanation: r?.explanation, quote: r?.evidence?.quote });
}

const mode = Object.values(results)[0]?.mode ?? "unknown";
console.log(`Server: ${server} (${mode} mode)`);
console.log(`Accuracy on readable pages: ${scored ? ((100 * correct) / scored).toFixed(1) : "n/a"}% (${correct}/${scored})`);
console.log(`Unreadable pages: ${cases.length - scored}\n`);
console.log("Expected \\ Got".padEnd(16) + LABELS.map((l) => l.padStart(14)).join(""));
for (const e of LABELS.slice(0, 3)) console.log(e.padEnd(16) + LABELS.map((g) => String(matrix[e][g]).padStart(14)).join(""));

// Precision for "contradicted" matters most: a false alarm accuses a source of saying something it didn't.
const flagged = LABELS.reduce((s, e) => s + (matrix[e]?.contradicted ?? 0), 0);
if (flagged) console.log(`\nContradicted precision: ${((100 * matrix.contradicted.contradicted) / flagged).toFixed(1)}%`);

if (misses.length) {
  console.log("\nDisagreements:");
  for (const m of misses) {
    console.log(`\n- [expected ${m.expected}, got ${m.got}] ${m.claim}\n  ${m.url}\n  ${m.explanation ?? ""}\n  Quote: ${m.quote ?? "none"}`);
  }
}

const out = resolve(dirname(file), `results-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ server, mode, correct, scored, matrix, misses }, null, 2));
console.log(`\nSaved ${out}`);
