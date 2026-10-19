// Builds a store-ready zip of ../extension into public/groundmark-extension.zip.
//
// - manifest.json sits at the top level of the zip, as the Chrome Web Store requires
// - the developer-only evaluation page (eval/) is left out
// - development-only matches (localhost, any *.vercel.app) are removed
// - the lab page on this site's own domain is added, if SITE_URL (or Vercel's
//   production URL) is known
//
// The same zip works for "Load unpacked": unzip it into a folder and pick that folder.

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { zipSync, strToU8 } from "fflate";

const root = resolve(import.meta.dirname, "..");
const extDir = resolve(root, "../extension");
const outFile = join(root, "public", "groundmark-extension.zip");

const siteUrl = (
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")
).replace(/\/+$/, "");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (name.startsWith(".") || name === "eval") return []; // the evaluation page is a developer tool
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const manifest = JSON.parse(readFileSync(join(extDir, "manifest.json"), "utf8"));
for (const cs of manifest.content_scripts) {
  cs.matches = cs.matches.filter((m) => !m.includes("localhost") && !m.includes("*.vercel.app"));
  if (siteUrl) {
    const u = new URL(siteUrl);
    cs.matches.push(`${u.protocol}//${u.host}/lab*`);
  }
}

const files = {};
for (const file of walk(extDir)) {
  const rel = relative(extDir, file).split("\\").join("/");
  const data = rel === "manifest.json" ? strToU8(JSON.stringify(manifest, null, 2) + "\n") : readFileSync(file);
  files[rel] = [data, { level: 9 }];
}

mkdirSync(join(root, "public"), { recursive: true });
writeFileSync(outFile, zipSync(files));
console.log(
  `Packaged ${Object.keys(files).length} files (v${manifest.version}) -> public/groundmark-extension.zip` +
    (siteUrl ? ` with the lab page on ${new URL(siteUrl).host}` : " (set SITE_URL to include your lab page)"),
);
