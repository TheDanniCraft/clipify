import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type LegacyCredential = { creatorId: string; iv: string; tag: string; ciphertext: string; expiresAt: Date };
export type ConvertedCredential = { iv: string; tag: string; ciphertext: string; expiresAt: Date; format: "better-auth-aes-256-gcm-v1" };

function decrypt(ciphertext: string, iv: string, tag: string, key: Buffer, aad: string): Buffer {
	const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
	decipher.setAAD(Buffer.from(aad, "utf8"));
	decipher.setAuthTag(Buffer.from(tag, "base64"));
	return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]);
}

export function convertLegacyCredential(legacy: LegacyCredential, oldKey: Buffer, newKey: Buffer, accountId: string, now = new Date()): ConvertedCredential {
	if (legacy.expiresAt.getTime() <= now.getTime()) throw new Error("CREDENTIAL_EXPIRED");
	const plaintext = decrypt(legacy.ciphertext, legacy.iv, legacy.tag, oldKey, `twitchUser:${legacy.creatorId}:oauth`);
	try {
		const iv = randomBytes(12);
		const cipher = createCipheriv("aes-256-gcm", newKey, iv);
		cipher.setAAD(Buffer.from(`better-auth:account:${accountId}`, "utf8"));
		const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
		return { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64"), expiresAt: legacy.expiresAt, format: "better-auth-aes-256-gcm-v1" };
	} finally {
		plaintext.fill(0);
	}
}

export function decryptConvertedCredential(credential: ConvertedCredential, key: Buffer, accountId: string): string {
	return decrypt(credential.ciphertext, credential.iv, credential.tag, key, `better-auth:account:${accountId}`).toString("utf8");
}

export class BetterAuthRefreshAuthority<TResult extends { accessToken: string; expiresAt: Date }> {
	private readonly pending = new Map<string, Promise<TResult>>();
	constructor(private readonly rotate: (accountId: string) => Promise<TResult>) {}
	async refresh(accountId: string, credential: { expiresAt: Date; revokedAt: Date | null }, now = new Date()): Promise<TResult> {
		if (credential.revokedAt) throw new Error("CREDENTIAL_REVOKED");
		if (credential.expiresAt.getTime() <= now.getTime()) throw new Error("CREDENTIAL_EXPIRED");
		const current = this.pending.get(accountId);
		if (current) return current;
		const operation = this.rotate(accountId).finally(() => {
			this.pending.delete(accountId);
		});
		this.pending.set(accountId, operation);
		return operation;
	}
}
