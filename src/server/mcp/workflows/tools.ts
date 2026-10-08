import { getRunnerSetup, listRunnersForPrincipal, getRunnerForPrincipal, createRunnerForPrincipal, updateRunnerForPrincipal, deleteRunnerForPrincipal, unlinkRunnerForPrincipal, listStreamSessionsForPrincipal, getStreamSessionForPrincipal, configureStreamSession, controlStreamSession, getRunnerSnapshot } from "@/server/resources/runners";
import { getCreatorPageSettings, updateCreatorPageSettings, publishCreatorPage } from "@/server/resources/creator-pages";
import { listGalleries, getGalleryForPrincipal, createGalleryForPrincipal, deleteGalleryForPrincipal, publishGalleryForPrincipal, getGalleryEmbed, getGalleryPreviewForPrincipal, getPlayerEmbed } from "@/server/resources/galleries";
import { searchClips, resolveClip, previewPlaylistImport, commitPlaylistImport } from "@/server/resources/discovery";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { getOverlayRuntime, getOverlayQueues, controlOverlay, enqueueOverlayClip, clearOverlayQueue } from "@/server/resources/remote";
import { workflowInputSchemas, type WorkflowToolName } from "./schemas";
import { workflowDescriptions } from "./catalogue";
import { submitFeedback } from "@/server/resources/feedback";
const handlers: Partial<Record<WorkflowToolName, (principal: TrustedCreatorPrincipal, input: unknown) => Promise<Record<string, unknown>>>> = {
	get_runner_snapshot: getRunnerSnapshot,
	control_stream_session: controlStreamSession,
	configure_stream_session: configureStreamSession,
	get_stream_session: getStreamSessionForPrincipal,
	list_stream_sessions: listStreamSessionsForPrincipal,
	unlink_runner: unlinkRunnerForPrincipal,
	delete_runner: deleteRunnerForPrincipal,
	update_runner: updateRunnerForPrincipal,
	create_runner: createRunnerForPrincipal,
	get_runner: getRunnerForPrincipal,
	list_runners: listRunnersForPrincipal,
	get_runner_setup: getRunnerSetup,
	publish_creator_page: publishCreatorPage,
	update_creator_page: updateCreatorPageSettings,
	get_creator_page: getCreatorPageSettings,
	get_player_embed: getPlayerEmbed,
	get_gallery_preview: getGalleryPreviewForPrincipal,
	get_gallery_embed: getGalleryEmbed,
	list_galleries: listGalleries,
	get_gallery: getGalleryForPrincipal,
	create_gallery: createGalleryForPrincipal,
	delete_gallery: deleteGalleryForPrincipal,
	publish_gallery: publishGalleryForPrincipal,
	search_clips: searchClips,
	resolve_clip: resolveClip,
	preview_playlist_import: previewPlaylistImport,
	commit_playlist_import: commitPlaylistImport,
	get_overlay_runtime: getOverlayRuntime,
	get_overlay_queues: getOverlayQueues,
	control_overlay: controlOverlay,
	enqueue_overlay_clip: enqueueOverlayClip,
	clear_overlay_queue: clearOverlayQueue,
	submit_feedback: submitFeedback,
};
export function workflowTools(principal: TrustedCreatorPrincipal) {
	return (Object.keys(handlers) as WorkflowToolName[]).map((name) => ({ name, description: workflowDescriptions[name], schema: workflowInputSchemas[name], run: (input: unknown) => handlers[name]!(principal, input) }));
}
