import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";

const root = new URL("../src/", import.meta.url);
const forbiddenImports = /firebase\/firestore/;
const forbiddenCalls = /\b(?:setDoc|updateDoc|addDoc|deleteDoc|runTransaction|arrayUnion|increment|writeBatch)\s*\(/;

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if ([".js", ".jsx", ".ts", ".tsx"].includes(extname(entry.name))) files.push(path);
  }
  return files;
}

const failures = [];
for (const file of await walk(root.pathname)) {
  const text = await readFile(file, "utf8");
  if (forbiddenImports.test(text) || forbiddenCalls.test(text)) failures.push(file.replace(root.pathname, "src/"));
}

if (failures.length) {
  console.error("Client Firestore boundary violation(s):");
  for (const file of failures) console.error(` - ${file}`);
  process.exit(1);
}

console.log("Client Firestore boundary: PASS");
