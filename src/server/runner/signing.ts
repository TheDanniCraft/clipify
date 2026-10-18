import "server-only";
import { createHash, createPrivateKey, createPublicKey } from "node:crypto";

export function runnerSigningKey() {
	const pem = process.env.RUNNER_EXECUTION_SIGNING_PRIVATE_KEY;
	if (!pem || pem.length > 16384) throw new Error("Runner signing key unavailable");
	try {
		const key = createPrivateKey(pem.replaceAll("\\n", "\n"));
		if (key.asymmetricKeyType !== "ed25519") throw new Error("Unsupported key");
		const keyId = createHash("sha256")
			.update(createPublicKey(key).export({ type: "spki", format: "der" }))
			.digest("hex")
			.slice(0, 16);
		return { key, keyId };
	} catch {
		throw new Error("Runner signing key unavailable");
	}
}
