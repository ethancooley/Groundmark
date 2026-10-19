// Zips ../extension into public/ so the site can serve it, pointing the
// extension's default checking server at this deployment.
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { zipSync, strToU8 } from "fflate";

const root = resolve(import.meta.dirname, "..");
const extDir = resolve(root, "../extension");
const outFile = join(root, "public", "overview-check-extension.zip");

const apiBase = (
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  "http://localhost:3000"
).replace(/\/+$/, "");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name.startsWith(".")) return [];
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = {};
for (const file of walk(extDir)) {
  const rel = relative(extDir, file).split("\\").join("/");
  let data = readFileSync(file);
  if (rel === "config.js") {
    data = strToU8(
      data.toString("utf8").replace(/OCX_DEFAULT_API_BASE = ".*?";/, `OCX_DEFAULT_API_BASE = ${JSON.stringify(apiBase)};`),
    );
  }
  files[`overview-check/${rel}`] = [data, { level: 9 }];
}

mkdirSync(join(root, "public"), { recursive: true });
writeFileSync(outFile, zipSync(files));
console.log(`Packaged ${Object.keys(files).length} extension files for ${apiBase} -> public/overview-check-extension.zip`);
