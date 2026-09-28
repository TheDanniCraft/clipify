import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type ManifestInput = {
	runId: string;
	sourceFingerprint: string;
	versions: Readonly<Record<string, string>>;
	createdAt: string;
	mode?: string;
	counts?: Readonly<Record<string, number>>;
	status?: string;
	smoke?: Readonly<Record<string, unknown>>;
};
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
	const payload = { ...input, versions: { ...input.versions }, ...(input.counts ? { counts: { ...input.counts } } : {}), ...(input.smoke ? { smoke: { ...input.smoke } } : {}) };
	const checksum = `sha256:${createHash("sha256").update(canonical(payload), "utf8").digest("hex")}`;
	Object.freeze(payload.versions);
	if ("counts" in payload && payload.counts) Object.freeze(payload.counts);
	if ("smoke" in payload && payload.smoke) Object.freeze(payload.smoke);
	return Object.freeze({ ...payload, checksum });
}

export function verifyManifest(manifest: CutoverManifest): boolean {
	return (
		buildManifest({
			runId: manifest.runId,
			sourceFingerprint: manifest.sourceFingerprint,
			versions: manifest.versions,
			createdAt: manifest.createdAt,
			...(manifest.mode === undefined ? {} : { mode: manifest.mode }),
			...(manifest.counts === undefined ? {} : { counts: manifest.counts }),
			...(manifest.status === undefined ? {} : { status: manifest.status }),
			...(manifest.smoke === undefined ? {} : { smoke: manifest.smoke }),
		}).checksum === manifest.checksum
	);
}

export function signManifest(manifest: CutoverManifest, secret: string): string {
	return `hmac-sha256:${createHmac("sha256", secret).update(manifest.checksum, "utf8").digest("hex")}`;
}

export function verifyManifestSignature(manifest: CutoverManifest, signature: string, secret: string): boolean {
	const expected = Buffer.from(signManifest(manifest, secret), "utf8");
	const actual = Buffer.from(signature, "utf8");
	return expected.length === actual.length && timingSafeEqual(expected, actual);
}
