import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
for (const key of ["--root", "--fingerprint", "--commit", "--repository", "--oci-digests", "--output"]) {
  if (!args.get(key)) throw new Error(`Missing ${key}`);
}

const expectedPlatforms = ["windows-x64", "linux-x64", "linux-arm64", "macos-x64", "macos-arm64"];
const root = args.get("--root");
const ociDigests = JSON.parse(readFileSync(args.get("--oci-digests"), "utf8"));
const artifacts = [];

for (const directory of readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
  const metadataPath = join(root, directory.name, "metadata.json");
  if (!existsSync(metadataPath)) continue;
  const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
  const binaryPath = join(root, directory.name, metadata.filename);
  if (!existsSync(binaryPath)) throw new Error(`Missing binary for ${metadata.platform}`);
  const content = readFileSync(binaryPath);
  const sha256 = createHash("sha256").update(content).digest("hex");
  if (sha256 !== metadata.sha256) throw new Error(`Hash mismatch for ${metadata.platform}`);
  if (metadata.sourceFingerprint !== args.get("--fingerprint")) throw new Error(`Fingerprint mismatch for ${metadata.platform}`);
  const digest = ociDigests[metadata.platform];
  if (!/^sha256:[0-9a-f]{64}$/.test(digest ?? "")) throw new Error(`Missing OCI digest for ${metadata.platform}`);
  artifacts.push({
    platform: metadata.platform,
    target: metadata.target,
    filename: metadata.filename,
    sha256,
    size: statSync(binaryPath).size,
    oci: {
      reference: `${args.get("--repository")}:fp-${args.get("--fingerprint")}-${metadata.platform}`,
      digest,
    },
  });
}

if (artifacts.length !== expectedPlatforms.length) throw new Error(`Expected ${expectedPlatforms.length} artifacts, found ${artifacts.length}`);
for (const platform of expectedPlatforms) if (!artifacts.some((artifact) => artifact.platform === platform)) throw new Error(`Missing ${platform}`);
if (new Set(artifacts.map((artifact) => artifact.platform)).size !== artifacts.length) throw new Error("Duplicate runner platform");
if (new Set(artifacts.map((artifact) => artifact.sha256)).size !== artifacts.length) throw new Error("Runner binaries unexpectedly share a hash");

const manifest = {
  schemaVersion: 1,
  sourceFingerprint: args.get("--fingerprint"),
  sourceCommit: args.get("--commit"),
  repository: args.get("--repository"),
  artifacts: artifacts.sort((a, b) => a.platform.localeCompare(b.platform)),
};
writeFileSync(args.get("--output"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
