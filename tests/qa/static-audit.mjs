import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const excluded = new Set([".git", "node_modules", ".firebase"]);
const files = await walk(root);
const htmlFiles = files.filter((file) => extname(file) === ".html");
const missing = [], duplicateIds = [], missingAlt = [], unsafeBlankTargets = [];

for (const file of htmlFiles) {
  const source = await readFile(file, "utf8");
  const ids = [...source.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) duplicateIds.push(`${relative(root, file)}: ${[...new Set(duplicates)].join(", ")}`);
  for (const match of source.matchAll(/<(?:a|link|script|img|source)\b[^>]*?\b(?:href|src)=["']([^"']+)["'][^>]*>/g)) {
    const target = match[1];
    if (!target || /^(?:https?:|mailto:|tel:|javascript:|#|data:|\/\/)/.test(target)) continue;
    const clean = target.split(/[?#]/)[0];
    const resolved = clean.startsWith("/") ? join(root, clean) : resolve(dirname(file), clean);
    try { await stat(resolved); } catch { missing.push(`${relative(root, file)} -> ${target}`); }
  }
  for (const match of source.matchAll(/<img\b[^>]*>/g)) if (!/\balt=["'][^"']*["']/.test(match[0])) missingAlt.push(`${relative(root, file)}: ${match[0].slice(0, 100)}`);
  for (const match of source.matchAll(/<a\b[^>]*\btarget=["']_blank["'][^>]*>/g)) if (!/\brel=["'][^"']*noopener/.test(match[0])) unsafeBlankTargets.push(`${relative(root, file)}: ${match[0].slice(0, 120)}`);
}

const largeAssets = [];
for (const file of files.filter((item) => /\.(?:png|jpe?g|gif|webp|svg|js|css)$/i.test(item))) {
  const size = (await stat(file)).size;
  if (size > 1024 * 1024) largeAssets.push({ file:relative(root, file), bytes:size });
}
largeAssets.sort((a, b) => b.bytes - a.bytes);

const report = { htmlFiles:htmlFiles.length, missingLocalReferences:missing, duplicateIds, missingAlt, unsafeBlankTargets, largeAssets };
console.log(JSON.stringify(report, null, 2));
if (missing.length || duplicateIds.length || missingAlt.length || unsafeBlankTargets.length) process.exitCode = 1;

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes:true })) {
    if (excluded.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(path));
    else output.push(path);
  }
  return output;
}
