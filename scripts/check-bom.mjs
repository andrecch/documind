/**
 * Verifica que ningún archivo fuente del workspace lleve BOM UTF-8
 * (el BOM rompe el parseo de Turbopack/Next y de algunos JSON loaders).
 */
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["apps", "packages", "docs"];
const EXTS = new Set([".json", ".ts", ".tsx", ".css", ".md", ".mjs", ".yml", ".yaml"]);

const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (["node_modules", ".next", ".turbo", ".git", "dist", "coverage"].includes(entry.name))
        continue;
      walk(path.join(dir, entry.name));
    } else if (EXTS.has(path.extname(entry.name))) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}
for (const root of ROOTS) {
  if (fs.existsSync(root)) walk(root);
}

const offenders = files.filter((f) => {
  const buf = fs.readFileSync(f);
  return buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
});

if (offenders.length > 0) {
  console.error("Archivos con BOM UTF-8 (stripear antes de commitear):");
  for (const f of offenders) console.error("  " + f);
  process.exit(1);
}
