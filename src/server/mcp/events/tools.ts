import "server-only";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { eventToolSchemas } from "./schemas";
const descriptions = {
	create_event_example: "Create the requested Babbler Awards example as an unlisted, unpublished draft with all nineteen supplied categories. Uses only this creator's cached clips from all years; other samples are labelled demo data. Does not upload files, connect providers, vote or publish. Not retry-idempotent; list events before retrying. Use get_event_preview to share the read-only show.",
	get_event_preview: "Create a read-only, seven-day preview link for a draft or published event. Includes root candidates and results for reviewing the show; does not publish or vote. Requires event:update. Share this preview with reviewers instead of the publishing-capable presenter link. Rotating the presenter link also revokes previews.",
	list_events: "List the approved creator's awards drafts and published events without presenter secrets.",
	get_event: "Read an award event's current configuration, revision and frozen data results without private credentials or voter identities.",
	create_event: "Create a validated awards draft. Public listing requires an active partner grant; unlisted events are available to every creator. This operation is not retry-idempotent. The presenter secret is omitted; rotate_event_presenter explicitly issues a new private link.",
	update_event: "Replace an unpublished event configuration using expectedRevision from get_event. Published rules are locked. Use update_event_presentation for the show deck after publication.",
	update_event_presentation: "Save the ordered slides and presenter chat settings at the current expectedRevision without changing published submission or voting rules.",
	publish_event: "Publish the event at its current expectedRevision. File categories require connected creator-owned S3 or Drive storage, configured through the dashboard. Google consent must be completed in the browser.",
	publish_event_results: "Explicitly publish closed-voting results and the historical public archive. Missing data results or unresolved team ties block publication. This reveals results to all viewers.",
	rotate_event_presenter: "Revoke the old presenter capability and return a new private URL fragment. Never publish this secret. This is not retry-idempotent.",
	get_event_review: "Read team candidates and grouped originals for nomination review. Never publish grouped originals. Private viewer identities and ballots are excluded.",
	nominate_event_candidates: "Replace the nominated root candidates in one category before voting is released; an empty list clears nominations. Group children cannot be nominated independently.",
	group_event_candidates: "Combine at least two text/link candidates under one presentation title, retaining each original proposal privately. This operation is not retry-idempotent.",
	release_event_review: "Confirm nominations and release held review. Voting still follows the saved roadmap; nominations become immutable.",
	add_event_candidate: "Add a team-provided text, choice, Twitch clip/person/game or linked YouTube nominee using the same source rules as the dashboard. File uploads use the dashboard. This operation is not retry-idempotent.",
	set_event_data_result: "Record or correct a manual data award before public release, optionally with a validated media reference. Use this for watchtime/team outcomes or missing historical snapshots; this category has no audience voting.",
	get_event_ties: "Read tied leading nominees after voting closes, without voter identities.",
	choose_event_tie_winner: "Resolve a category configured for a team tie decision by choosing one of its tied leading nominees before results are published.",
};
function unwrap<T extends { ok: boolean; code?: string }>(result: T) {
	if (!result.ok) throw new Error(result.code === "NOT_FOUND" ? "RESOURCE_UNAVAILABLE" : result.code === "AUTHENTICATION_REQUIRED" ? "ACCESS_DENIED" : (result.code ?? "SERVICE_UNAVAILABLE"));
	return result;
}
export function eventTools(principal: TrustedCreatorPrincipal) {
	return (Object.keys(eventToolSchemas) as (keyof typeof eventToolSchemas)[]).map((name) => ({
		name,
		schema: eventToolSchemas[name],
		description: descriptions[name],
		run: async (raw: unknown): Promise<Record<string, unknown>> => {
			switch (name) {
				case "create_event_example": {
					const i = eventToolSchemas[name].parse(raw);
					return unwrap(await (await import("@/server/events/examples")).createAwardExample(principal, i.creatorId));
				}
				case "get_event_preview": {
					const i = eventToolSchemas[name].parse(raw);
					const result = unwrap(await (await import("@/server/events/preview")).createAwardPreview(principal, i.creatorId, i.eventId));
					return result.ok ? { ok: true, previewPath: `/events/${i.eventId}/preview#${result.token}` } : result;
				}
				case "list_events": {
					const i = eventToolSchemas[name].parse(raw);
					return unwrap(await (await import("@/server/events/persistence")).listAwardEvents(principal, i.creatorId));
				}
				case "get_event": {
					const i = eventToolSchemas[name].parse(raw);
					return unwrap(await (await import("@/server/events/persistence")).readAwardEvent(principal, i.creatorId, i.eventId));
				}
				case "create_event": {
					const i = eventToolSchemas[name].parse(raw),
						result = unwrap(await (await import("@/server/events/persistence")).createAwardEvent(principal, i.creatorId, i.configuration));
					if (!result.ok) return result;
					return { ok: true, event: result.event };
				}
				case "update_event": {
					const i = eventToolSchemas[name].parse(raw);
					return unwrap(await (await import("@/server/events/persistence")).updateAwardEvent(principal, i.creatorId, i.eventId, i.expectedRevision, i.configuration));
				}
				case "update_event_presentation": {
					const i = eventToolSchemas[name].parse(raw);
					return unwrap(await (await import("@/server/events/persistence")).saveAwardPresentation(principal, i.creatorId, i.eventId, i.expectedRevision, { slides: i.slides, presentation: i.presentation }));
				}
				case "publish_event": {
					const i = eventToolSchemas[name].parse(raw);
					return unwrap(await (await import("@/server/events/lifecycle")).publishAwardEvent(principal, i.creatorId, i.eventId, i.expectedRevision));
				}
				case "publish_event_results": {
					const i = eventToolSchemas[name].parse(raw);
					return unwrap(await (await import("@/server/events/lifecycle")).publishAwardResults(principal, i.creatorId, i.eventId));
				}
				case "rotate_event_presenter": {
					const i = eventToolSchemas[name].parse(raw),
						result = unwrap(await (await import("@/server/events/lifecycle")).rotateAwardPresenterSecret(principal, i.creatorId, i.eventId));
					return result.ok ? { ok: true, presenterPath: `/events/${i.eventId}/present#${result.presenterSecret}` } : result;
				}
				case "get_event_review": {
					const i = eventToolSchemas[name].parse(raw);
					return unwrap(await (await import("@/server/events/review")).readAwardReview(principal, i.creatorId, i.eventId));
				}
				case "nominate_event_candidates": {
					const i = eventToolSchemas[name].parse(raw);
					return unwrap(await (await import("@/server/events/review")).nominateAwardCandidates(principal, i.creatorId, i.eventId, i.categoryId, i.candidateIds));
				}
				case "group_event_candidates": {
					const i = eventToolSchemas[name].parse(raw);
					return unwrap(await (await import("@/server/events/review")).groupAwardCandidates(principal, i.creatorId, i.eventId, i.categoryId, i.candidateIds, i.title));
				}
				case "release_event_review": {
					const i = eventToolSchemas[name].parse(raw);
					return unwrap(await (await import("@/server/events/review")).releaseAwardReview(principal, i.creatorId, i.eventId));
				}
				case "add_event_candidate": {
					const i = eventToolSchemas[name].parse(raw);
					return unwrap(await (await import("@/server/events/review")).addAwardTeamCandidate(principal, i.creatorId, i.eventId, i.categoryId, i.proposal));
				}
				case "set_event_data_result": {
					const i = eventToolSchemas[name].parse(raw);
					return unwrap(await (await import("@/server/events/freeze")).setAwardDataResult(principal, i.creatorId, i.eventId, i.categoryId, i.result));
				}
				case "get_event_ties": {
					const i = eventToolSchemas[name].parse(raw);
					return unwrap(await (await import("@/server/events/ties")).readAwardTieResults(principal, i.creatorId, i.eventId));
				}
				case "choose_event_tie_winner": {
					const i = eventToolSchemas[name].parse(raw);
					return unwrap(await (await import("@/server/events/ties")).chooseAwardTieWinner(principal, i.creatorId, i.eventId, i.categoryId, i.candidateId));
				}
			}
		},
	}));
}
