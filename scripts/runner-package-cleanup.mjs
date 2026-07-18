import { pathToFileURL } from "node:url";
const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);

const pr = args.get("--pr");
const mode = args.get("--mode") ?? "superseded";
const keepFingerprint = args.get("--keep-fingerprint");
const keepFingerprints = new Set((args.get("--keep-fingerprints") ?? "").split(",").filter(Boolean));
if (mode !== "legacy" && !/^[1-9][0-9]*$/.test(pr ?? "")) throw new Error("Missing or invalid --pr");
if (!["superseded", "closed", "legacy", "preview-alias"].includes(mode)) throw new Error("Invalid --mode");
if (mode === "superseded" && !/^[0-9a-f]{64}$/.test(keepFingerprint ?? "")) throw new Error("Missing or invalid --keep-fingerprint");
if (mode === "legacy" && (![...keepFingerprints].every((value) => /^[0-9a-f]{64}$/.test(value)) || keepFingerprints.size === 0)) throw new Error("Legacy cleanup requires --keep-fingerprints with at least one fingerprint");

export function selectVersionIds(value, { pr, mode, keepFingerprint }) {
	const versions = value.flat(Infinity).filter((entry) => entry && typeof entry === "object" && entry.id !== undefined);
	const prefix = `pr-${pr}-`;
	const keepPrefix = `pr-${pr}-fp-${keepFingerprint}-`;
	const selected = [];
	for (const version of versions) {
		const tags = version.metadata?.container?.tags;
		if (!Array.isArray(tags) || tags.length === 0) continue;
		if (mode === "preview-alias") {
			if (tags.length === 1 && tags[0] === `pr-${pr}-latest-manifest`) selected.push(String(version.id));
			continue;
		}
		if (mode === "legacy") {
			if (tags.some((tag) => typeof tag !== "string" || !/^fp-[0-9a-f]{64}-(?:windows-x64|linux-x64|linux-arm64|macos-x64|macos-arm64|manifest)$/.test(tag))) continue;
			const fingerprints = tags.map((tag) => tag.match(/^fp-([0-9a-f]{64})-/)?.[1]);
			if (fingerprints.some((fingerprint) => !fingerprint || keepFingerprints.has(fingerprint))) continue;
			selected.push(String(version.id));
			continue;
		}
		if (!tags.some((tag) => typeof tag === "string" && tag.startsWith(prefix))) continue;
		if (tags.some((tag) => typeof tag === "string" && !tag.startsWith(prefix))) continue;
		if (mode === "superseded" && tags.some((tag) => typeof tag === "string" && tag.startsWith(keepPrefix))) continue;
		if (mode === "superseded" && tags.includes(`pr-${pr}-latest-manifest`)) continue;
		selected.push(String(version.id));
	}
	return [...new Set(selected)];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const input = await new Response(process.stdin).text();
	const ids = selectVersionIds(JSON.parse(input), { pr, mode, keepFingerprint, keepFingerprints });
	for (const id of ids) console.log(id);
	console.error(`Selected ${ids.length} Runner package version(s) for ${mode} cleanup${pr ? ` of PR ${pr}` : ""}.`);
}
