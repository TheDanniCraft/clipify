import { readFileSync } from "node:fs";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
for (const key of ["--manifest", "--fingerprint", "--repository"]) {
	if (!args.get(key)) throw new Error(`Missing ${key}`);
}

const platforms = ["windows-x64", "linux-x64", "linux-arm64", "macos-x64", "macos-arm64"];
const manifest = JSON.parse(readFileSync(args.get("--manifest"), "utf8"));
const repository = args
	.get("--repository")
	.replace(/^https?:\/\//, "")
	.replace(/\/$/, "")
	.toLowerCase();

if (manifest.schemaVersion !== 1) throw new Error("Unsupported Runner manifest schema");
if (manifest.sourceFingerprint !== args.get("--fingerprint")) throw new Error("Runner manifest fingerprint does not match the production source");
if (manifest.repository !== repository) throw new Error("Runner manifest repository does not match the production repository");
if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length !== platforms.length) throw new Error("Runner manifest is incomplete");
if (new Set(manifest.artifacts.map((artifact) => artifact.platform)).size !== platforms.length) throw new Error("Runner manifest contains duplicate platforms");

for (const platform of platforms) {
	const artifact = manifest.artifacts.find((entry) => entry.platform === platform);
	if (!artifact) throw new Error(`Runner manifest is missing ${platform}`);
	if (!/^[0-9a-f]{64}$/.test(artifact.sha256 ?? "")) throw new Error(`Invalid Runner SHA-256 for ${platform}`);
	if (!/^sha256:[0-9a-f]{64}$/.test(artifact.oci?.digest ?? "")) throw new Error(`Invalid Runner OCI digest for ${platform}`);
	const expectedReference = `${repository}:fp-${args.get("--fingerprint")}-${platform}`;
	if (artifact.oci.reference !== expectedReference) throw new Error(`Runner OCI reference mismatch for ${platform}`);
}

console.log(`Verified Runner manifest for ${args.get("--fingerprint")} (${platforms.length} platforms)`);
