import "server-only";
import { parseClipReference } from "@/server/resources/clip-references";
import { resolveValidatedPlaylistClips } from "@/server/resources/clip-validation";
import { publicClip } from "@/server/resources/clip-discovery";
import { resolveTwitchClipPlaybackUrl } from "@/server/clip-playback-resolver";
import { isTrustedClipMediaUrl } from "@/app/lib/clipExport";
import { ConnectedAppError } from "./grants";
export async function resolveConnectedClip(creatorId: string, reference: string, playback = false) {
	let clipId: string;
	try {
		clipId = parseClipReference(reference);
	} catch {
		throw new ConnectedAppError("INVALID_INPUT", 400);
	}
	const clips = await resolveValidatedPlaylistClips(creatorId, [clipId]);
	const clip = clips.find((c) => c.id === clipId && c.broadcaster_id === creatorId);
	if (!clip) throw new ConnectedAppError("NOT_FOUND", 404);
	if (!playback) return { creatorId, clip: publicClip(clip) };
	const playbackUrl = await resolveTwitchClipPlaybackUrl(clipId, creatorId);
	if (!playbackUrl || !isTrustedClipMediaUrl(playbackUrl)) throw new ConnectedAppError("RESOURCE_UNAVAILABLE", 404);
	return { creatorId, clipId, playbackUrl };
}
