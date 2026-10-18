import { existsSync } from "node:fs";
import { join } from "node:path";
import { createHash, generateKeyPairSync } from "node:crypto";

test("TDD-US1-CON004 trusted verification key configuration retains public Ed25519 keys under their exact signing key IDs", () => {
	const parse = existsSync(join(__dirname, "../execution-keys.ts")) ? jest.requireActual("../execution-keys").parseExecutionPublicKeys : undefined;
	const { publicKey } = generateKeyPairSync("ed25519");
	const keyId = createHash("sha256")
		.update(publicKey.export({ type: "spki", format: "der" }))
		.digest("hex")
		.slice(0, 16);
	const second = keyFixture();
	const keys = { [keyId]: publicKey.export({ type: "spki", format: "pem" }).toString(), [second.id]: second.public };
	expect(parse?.(JSON.stringify(keys))).toEqual(keys);
	expect(Object.keys(parse(JSON.stringify(keys)))).toEqual(Object.keys(keys).sort());
	expect(parse(undefined)).toEqual({});
});

function keyFixture(type: "ed25519" | "ec" = "ed25519") {
	const pair = type === "ed25519" ? generateKeyPairSync("ed25519") : generateKeyPairSync("ec", { namedCurve: "prime256v1" });
	const id = createHash("sha256")
		.update(pair.publicKey.export({ type: "spki", format: "der" }))
		.digest("hex")
		.slice(0, 16);
	return { id, public: pair.publicKey.export({ type: "spki", format: "pem" }).toString(), private: pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString() };
}
const fixtureKey = keyFixture(),
	ecKey = keyFixture("ec");
const excessive = Object.fromEntries(
	Array.from({ length: 9 }, () => {
		const key = keyFixture();
		return [key.id, key.public];
	}),
);
test.each([
	{ name: "malformed JSON", raw: "{private-configuration" },
	{ name: "array", raw: "[]" },
	{ name: "null", raw: "null" },
	{ name: "private key", raw: JSON.stringify({ [fixtureKey.id]: fixtureKey.private }) },
	{ name: "wrong algorithm", raw: JSON.stringify({ [ecKey.id]: ecKey.public }) },
	{ name: "wrong key ID", raw: JSON.stringify({ ["f".repeat(16)]: fixtureKey.public }) },
	{ name: "invalid PEM", raw: JSON.stringify({ [fixtureKey.id]: "invalid-pem" }) },
	{ name: "oversized input", raw: JSON.stringify({ invalid: "x".repeat(65536) }) },
	{ name: "too many verification keys", raw: JSON.stringify(excessive) },
])("TDD-US1-CON004 rejects $name with a generic error before key material can be baked", ({ raw }) => {
	const { parseExecutionPublicKeys } = jest.requireActual("../execution-keys");
	expect(() => parseExecutionPublicKeys(raw)).toThrow("Runner public verification keys invalid");
});
