import { decryptString } from "@lib/encryption";

type OverlayCredential = { id: string; secret: string | null };
type RunnerCredential = { id: string; token: string };
type StreamCredential = { id: string; runnerId: string | null; overlayId: string; rtmpUrl: string; encryptedStreamKey: string | null };

export function collectReusableCredentialExport(input: { overlays: OverlayCredential[]; runners: RunnerCredential[]; streamSessions: StreamCredential[]; destinations?: Array<{ id: string; provider: string; rtmpUrl: string; encryptedStreamKey: string | null }> }) {
	return {
		overlays: input.overlays.filter((row) => Boolean(row.secret)).map((row) => ({ overlayId: row.id, value: row.secret })),
		runners: input.runners.filter((row) => Boolean(row.token)).map((row) => ({ runnerId: row.id, value: row.token })),
		streamDestinations: input.streamSessions.filter((row) => Boolean(row.encryptedStreamKey)).map((row) => ({ streamSessionId: row.id, runnerId: row.runnerId, overlayId: row.overlayId, rtmpUrl: row.rtmpUrl, value: decryptString(row.encryptedStreamKey!) })),
		...(input.destinations ? { namedDestinations: input.destinations.filter((row) => Boolean(row.encryptedStreamKey)).map((row) => ({ destinationId: row.id, provider: row.provider, rtmpUrl: row.rtmpUrl, value: decryptString(row.encryptedStreamKey!), storedEncryptedValue: row.encryptedStreamKey })) } : {}),
	};
}

export async function collectOAuthCredentialExport(accounts: Array<{ id: string; providerId: string; accountId: string; accessToken: string | null; refreshToken: string | null; idToken: string | null }>) {
	async function decode(stored: string | null) {
		if (!stored) return null;
		if (!stored.startsWith("$ba$") && !(stored.length % 2 === 0 && /^[0-9a-f]+$/i.test(stored))) return { value: stored, storage: "plaintext" };
		try {
			const [{ auth }, { symmetricDecrypt }] = await Promise.all([import("@/auth/config"), import("better-auth/crypto")]);
			return { value: await symmetricDecrypt({ key: (await auth.$context).secretConfig, data: stored }), storage: "encrypted" };
		} catch {
			return { storedValue: stored, storage: "encrypted", status: "decryption_unavailable" };
		}
	}
	return Promise.all(accounts.map(async (account) => ({ accountId: account.id, providerId: account.providerId, providerAccountId: account.accountId, accessToken: await decode(account.accessToken), refreshToken: await decode(account.refreshToken), idToken: await decode(account.idToken) })));
}
