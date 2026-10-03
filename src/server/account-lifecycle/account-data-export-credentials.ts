import { decryptString } from "@lib/encryption";

type OverlayCredential = { id: string; secret: string | null };
type RunnerCredential = { id: string; token: string };
type StreamCredential = { id: string; runnerId: string | null; overlayId: string; rtmpUrl: string; encryptedStreamKey: string | null };

export function collectReusableCredentialExport(input: { overlays: OverlayCredential[]; runners: RunnerCredential[]; streamSessions: StreamCredential[] }) {
	return {
		overlays: input.overlays.filter((row) => Boolean(row.secret)).map((row) => ({ overlayId: row.id, value: row.secret })),
		runners: input.runners.filter((row) => Boolean(row.token)).map((row) => ({ runnerId: row.id, value: row.token })),
		streamDestinations: input.streamSessions.filter((row) => Boolean(row.encryptedStreamKey)).map((row) => ({ streamSessionId: row.id, runnerId: row.runnerId, overlayId: row.overlayId, rtmpUrl: row.rtmpUrl, value: decryptString(row.encryptedStreamKey ?? "") })),
	};
}
