import { createHash } from "node:crypto";

export type ManifestInput = { runId: string; sourceFingerprint: string; versions: Readonly<Record<string, string>>; createdAt: string };
export type CutoverManifest = Readonly<ManifestInput & { checksum: string }>;

function canonical(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
	if (value && typeof value === "object") {
		return `{${Object.entries(value as Record<string, unknown>)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

export function buildManifest(input: ManifestInput): CutoverManifest {
	const payload = { ...input, versions: { ...input.versions } };
	const checksum = `sha256:${createHash("sha256").update(canonical(payload), "utf8").digest("hex")}`;
	Object.freeze(payload.versions);
	return Object.freeze({ ...payload, checksum });
}

export function verifyManifest(manifest: CutoverManifest): boolean {
	return buildManifest({ runId: manifest.runId, sourceFingerprint: manifest.sourceFingerprint, versions: manifest.versions, createdAt: manifest.createdAt }).checksum === manifest.checksum;
}
