import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const source = path.join(repoRoot, "dist");
const destination = path.join(repoRoot, "plugins", "proteus", "dist");

if (!fs.existsSync(source)) {
  throw new Error(`missing build output: ${source}`);
}

const cvssPackageRoot = path.dirname(require.resolve("ae-cvss-calculator/package.json"));
const vendorDir = path.join(source, "vendor");
fs.mkdirSync(vendorDir, { recursive: true });
fs.copyFileSync(
  path.join(cvssPackageRoot, "dist", "ae-cvss-calculator.js"),
  path.join(vendorDir, "ae-cvss-calculator.cjs")
);
fs.copyFileSync(
  path.join(cvssPackageRoot, "LICENSE"),
  path.join(vendorDir, "ae-cvss-calculator.LICENSE")
);

fs.rmSync(destination, { recursive: true, force: true });
fs.cpSync(source, destination, { recursive: true });
