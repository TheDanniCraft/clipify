import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const [root, expectedFingerprint] = process.argv.slice(2);
const expected = new Set(["windows-x64", "linux-x64", "linux-arm64", "macos-x64", "macos-arm64"]);
const records = [];
for (const directory of readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
  const metadataPath = join(root, directory.name, "metadata.json");
  if (!existsSync(metadataPath)) continue;
  const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
  const binaryPath = join(root, directory.name, metadata.filename);
  if (!existsSync(binaryPath)) throw new Error(`Missing binary for ${metadata.platform}`);
  const actualHash = createHash("sha256").update(readFileSync(binaryPath)).digest("hex");
  if (actualHash !== metadata.sha256) throw new Error(`Hash mismatch for ${metadata.platform}`);
  if (metadata.sourceFingerprint !== expectedFingerprint) throw new Error(`Fingerprint mismatch for ${metadata.platform}`);
  records.push(metadata);
}
if (records.length !== expected.size) throw new Error(`Expected ${expected.size} runner artifacts, found ${records.length}`);
if (new Set(records.map((record) => record.platform)).size !== records.length) throw new Error("Duplicate runner platform");
for (const platform of expected) if (!records.some((record) => record.platform === platform)) throw new Error(`Missing ${platform}`);
if (new Set(records.map((record) => record.sha256)).size !== records.length) throw new Error("Runner binaries unexpectedly share a hash");
console.log(JSON.stringify({ sourceFingerprint: expectedFingerprint, artifacts: records }, null, 2));
