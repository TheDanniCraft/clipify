/** @jest-environment node */
import { createCipheriv, randomBytes } from "node:crypto";
import { verifyBackupAttestation } from "../../../scripts/auth-cutover/preflight";
import { compareCutoverInvariants } from "../../../scripts/auth-cutover/validate";
import { BetterAuthRefreshAuthority, convertLegacyCredential, decryptConvertedCredential, type LegacyCredential } from "../../../scripts/auth-cutover/credentials";

const now = new Date("2026-09-28T12:00:00.000Z");
const attestation = {
	createdAt: "2026-09-28T11:30:00.000Z",
	checksum: "sha256:backup",
	checksumVerified: true,
	restoreDrillReference: "drill-2026-09-27",
	sourceFingerprint: "sha256:source",
	versions: { postgres: "17", app: "abc123" },
	availableBytes: 2_000,
	requiredBytes: 1_000,
};

describe("TDD-US6-002 backup, invariant, and credential safety", () => {
	it.each([
		["absent", null, "BACKUP_ABSENT"],
		["invalid", { ...attestation, checksumVerified: false }, "BACKUP_INVALID"],
		["incomplete", { ...attestation, restoreDrillReference: "" }, "BACKUP_INCOMPLETE"],
		["stale", { ...attestation, createdAt: "2026-09-27T00:00:00.000Z" }, "BACKUP_STALE"],
		["wrong-source", { ...attestation, sourceFingerprint: "sha256:other" }, "SOURCE_FINGERPRINT_MISMATCH"],
	] as const)("rejects a %s backup", (_name, backup, code) => {
		expect(() => verifyBackupAttestation(backup, { sourceFingerprint: "sha256:source", maximumAgeMs: 60 * 60 * 1000, now })).toThrow(code);
	});

	it("accepts a complete recent verified backup", () => {
		expect(verifyBackupAttestation(attestation, { sourceFingerprint: "sha256:source", maximumAgeMs: 60 * 60 * 1000, now })).toEqual(attestation);
	});

	it("requires exact entity counts and byte-for-byte runtime values", () => {
		const source = { creators: [{ id: "c1" }], resources: [{ id: "o1", ownerId: "c1", secret: "exact-secret", url: "/embed/o1" }], subscriptions: [{ id: "s1", creatorId: "c1" }], entitlements: [{ id: "e1", creatorId: "c1" }], twitchSubjects: ["t1"] };
		expect(compareCutoverInvariants(source, structuredClone(source))).toEqual({ valid: true, counts: { creators: 1, resources: 1, subscriptions: 1, entitlements: 1 } });
		expect(() => compareCutoverInvariants(source, { ...structuredClone(source), resources: [{ ...source.resources[0]!, secret: "changed" }] })).toThrow("RUNTIME_BYTE_PARITY_FAILED");
		expect(() => compareCutoverInvariants(source, { ...structuredClone(source), entitlements: [] })).toThrow("ENTITY_COUNT_MISMATCH");
		expect(() => compareCutoverInvariants(source, { ...structuredClone(source), twitchSubjects: ["t1", "t1"] })).toThrow("DUPLICATE_TWITCH_SUBJECT");
	});

	it("decrypts legacy AES-GCM with the exact creator AAD and only returns re-encrypted material", () => {
		const oldKey = randomBytes(32);
		const newKey = randomBytes(32);
		const iv = randomBytes(12);
		const cipher = createCipheriv("aes-256-gcm", oldKey, iv);
		cipher.setAAD(Buffer.from("twitchUser:creator-1:oauth"));
		const ciphertext = Buffer.concat([cipher.update("refresh-token-value", "utf8"), cipher.final()]);
		const legacy: LegacyCredential = { creatorId: "creator-1", iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64"), expiresAt: new Date("2026-10-01T00:00:00.000Z") };
		const converted = convertLegacyCredential(legacy, oldKey, newKey, "account-1", now);
		expect(JSON.stringify(converted)).not.toContain("refresh-token-value");
		expect(decryptConvertedCredential(converted, newKey, "account-1")).toBe("refresh-token-value");
		expect(() => convertLegacyCredential({ ...legacy, creatorId: "creator-2" }, oldKey, newKey, "account-1", now)).toThrow();
	});

	it.each([
		["expired", { expiresAt: new Date("2026-09-28T11:59:59.999Z"), revokedAt: null }, "CREDENTIAL_EXPIRED"],
		["revoked", { expiresAt: new Date("2026-10-01T00:00:00.000Z"), revokedAt: new Date("2026-09-28T11:00:00.000Z") }, "CREDENTIAL_REVOKED"],
	] as const)("rejects %s credentials", async (_state, credential, code) => {
		const authority = new BetterAuthRefreshAuthority(async () => ({ accessToken: "new", expiresAt: new Date("2026-10-01T00:00:00.000Z") }));
		await expect(authority.refresh("account-1", credential, now)).rejects.toThrow(code);
	});

	it("serializes refresh per account and rotates atomically through one authority", async () => {
		let calls = 0;
		const authority = new BetterAuthRefreshAuthority(async () => {
			calls += 1;
			await Promise.resolve();
			return { accessToken: "rotated", expiresAt: new Date("2026-10-01T00:00:00.000Z") };
		});
		const credential = { expiresAt: new Date("2026-09-28T12:00:01.000Z"), revokedAt: null };
		const [left, right] = await Promise.all([authority.refresh("account-1", credential, now), authority.refresh("account-1", credential, now)]);
		expect(left).toEqual(right);
		expect(calls).toBe(1);
	});
});
