import { createHash, createPublicKey } from "node:crypto";

/** Only explicitly configured public keys confer execution-signing trust. */
export function parseExecutionPublicKeys(raw: string | undefined): Readonly<Record<string, string>> {
	if (raw === undefined || raw === "") return Object.freeze({});
	try {
		if (raw.length > 65536) throw new Error();
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
		const entries = Object.entries(parsed);
		if (entries.length > 8) throw new Error();
		const keys: Record<string, string> = {};
		for (const [id, pem] of entries.sort(([a], [b]) => a.localeCompare(b))) {
			if (!/^[a-f0-9]{16}$/.test(id) || typeof pem !== "string" || pem.length > 16384 || !pem.trim().startsWith("-----BEGIN PUBLIC KEY-----") || !pem.trim().endsWith("-----END PUBLIC KEY-----")) throw new Error();
			const key = createPublicKey(pem);
			if (key.asymmetricKeyType !== "ed25519") throw new Error();
			const expected = createHash("sha256")
				.update(key.export({ type: "spki", format: "der" }))
				.digest("hex")
				.slice(0, 16);
			if (id !== expected) throw new Error();
			keys[id] = key.export({ type: "spki", format: "pem" }).toString();
		}
		return Object.freeze(keys);
	} catch {
		throw new Error("Runner public verification keys invalid");
	}
}
