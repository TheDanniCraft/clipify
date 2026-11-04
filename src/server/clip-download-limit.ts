import "server-only";
import { consumeDatabaseRateLimit } from "@/auth/rate-limit";

/** Manual jobs share the creator's budget across members, formats and instances. */
export async function reserveClipDownloadJob(creatorId: string) {
	return consumeDatabaseRateLimit({ action: "clip-download-job", identityKey: creatorId, networkKey: creatorId, limit: 3, windowMs: 60000, now: new Date() });
}
/** Twitch allows 100 download-URL requests/minute, with at most 10 clips in each request. */
export async function reserveTwitchClipDownloadRequest(creatorId: string) {
	return consumeDatabaseRateLimit({ action: "twitch-clip-download", identityKey: creatorId, networkKey: creatorId, limit: 100, windowMs: 60000, now: new Date() });
}
