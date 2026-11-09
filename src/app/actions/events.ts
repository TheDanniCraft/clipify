"use server";
import { getVerifiedSessionPrincipal } from "@/auth/session-principal";
import { createAwardEvent, listAwardEvents, readAwardEvent, updateAwardEvent } from "@/server/events/persistence";
const unauthenticated = { ok: false as const, code: "AUTHENTICATION_REQUIRED" as const };
export async function createEventAction(creatorId: string, input: unknown) {
	const principal = await getVerifiedSessionPrincipal();
	return principal ? createAwardEvent(principal, creatorId, input) : unauthenticated;
}
export async function listEventsAction(creatorId: string) {
	const principal = await getVerifiedSessionPrincipal();
	return principal ? listAwardEvents(principal, creatorId) : unauthenticated;
}
export async function getEventAction(creatorId: string, eventId: string) {
	const principal = await getVerifiedSessionPrincipal();
	return principal ? readAwardEvent(principal, creatorId, eventId) : unauthenticated;
}
export async function saveEventAction(creatorId: string, eventId: string, revision: number, input: unknown) {
	const principal = await getVerifiedSessionPrincipal();
	return principal ? updateAwardEvent(principal, creatorId, eventId, revision, input) : unauthenticated;
}
export async function publishEventAction(creatorId: string, eventId: string, revision: number) {
	const principal = await getVerifiedSessionPrincipal();
	if (!principal) return unauthenticated;
	return (await import("@/server/events/lifecycle")).publishAwardEvent(principal, creatorId, eventId, revision);
}
export async function publishEventResultsAction(creatorId: string, eventId: string) {
	const principal = await getVerifiedSessionPrincipal();
	if (!principal) return unauthenticated;
	return (await import("@/server/events/lifecycle")).publishAwardResults(principal, creatorId, eventId);
}
export async function rotateEventPresenterAction(creatorId: string, eventId: string) {
	const principal = await getVerifiedSessionPrincipal();
	if (!principal) return unauthenticated;
	return (await import("@/server/events/lifecycle")).rotateAwardPresenterSecret(principal, creatorId, eventId);
}

export async function getPublicEventAction(eventId: string) {
	const participant = await (await import("@/server/events/participant")).getEventParticipant();
	const result = await (await import("@/server/events/public-read")).readPublicAwardEvent(eventId, participant?.authUserId);
	if (!result.ok) return result;
	const own = participant ? await (await import("@/server/events/submissions")).ownAwardSubmissions(participant.authUserId, eventId) : null;
	return { ...result, participating: !!participant, submissions: own?.ok ? own.submissions.map((s) => ({ id: s.id, categoryId: s.categoryId, original: s.original })) : [] };
}
export async function beginEventLoginAction(eventId: string) {
	const event = await (await import("@/server/events/public-read")).readPublicAwardEvent(eventId);
	if (!event.ok) return event;
	const { resolveBaseUrl } = await import("@lib/baseUrl");
	const callbackURL = new URL(`/events/${eventId}`, resolveBaseUrl().origin).toString();
	try {
		const { auth } = await import("@/auth/config");
		const result = await auth.api.signInSocial({ body: { provider: "twitch", callbackURL, errorCallbackURL: callbackURL, disableRedirect: true, additionalData: { eventParticipation: eventId } } });
		return { ok: true as const, url: result.url };
	} catch {
		return { ok: false as const, code: "SERVICE_UNAVAILABLE" as const };
	}
}
export async function submitEventAction(eventId: string, categoryId: string, input: unknown) {
	const participant = await (await import("@/server/events/participant")).getEventParticipant();
	if (!participant) return unauthenticated;
	try {
		const { resolveEventCandidate } = await import("@/server/events/sources");
		const content = await resolveEventCandidate(eventId, categoryId, input);
		return await (await import("@/server/events/submissions")).submitAwardCandidate(participant.authUserId, eventId, categoryId, content);
	} catch {
		return { ok: false as const, code: "INVALID_INPUT" as const };
	}
}
export async function withdrawEventSubmissionAction(eventId: string, submissionId: string) {
	const participant = await (await import("@/server/events/participant")).getEventParticipant();
	if (!participant) return unauthenticated;
	return (await import("@/server/events/submissions")).withdrawAwardSubmission(participant.authUserId, eventId, submissionId);
}
export async function voteEventAction(eventId: string, categoryId: string, selected: string[]) {
	const participant = await (await import("@/server/events/participant")).getEventParticipant();
	if (!participant) return unauthenticated;
	return (await import("@/server/events/voting")).saveAwardVotes(participant.authUserId, eventId, categoryId, selected);
}
export async function searchEventSourcesAction(eventId: string, categoryId: string, query: string) {
	const participant = await (await import("@/server/events/participant")).getEventParticipant();
	if (!participant) return unauthenticated;
	try {
		return { ok: true as const, items: await (await import("@/server/events/sources")).searchEventSources(eventId, categoryId, query) };
	} catch {
		return { ok: false as const, code: "INVALID_INPUT" as const };
	}
}

export async function listEventConnectionsAction(creatorId: string) {
	const principal = await getVerifiedSessionPrincipal();
	return principal ? (await import("@/server/events/connections")).listEventConnections(principal, creatorId) : unauthenticated;
}
export async function beginEventGoogleConnectionAction(creatorId: string, provider: "drive" | "youtube", eventId: string) {
	const principal = await getVerifiedSessionPrincipal();
	if (!principal) return unauthenticated;
	if (!/^[0-9a-f-]{36}$/i.test(eventId)) return { ok: false as const, code: "INVALID_INPUT" as const };
	return (await import("@/server/events/connections")).beginEventGoogleConnection(principal, creatorId, provider, `/dashboard/events/${eventId}`);
}
export async function saveEventS3ConnectionAction(creatorId: string, input: unknown) {
	const principal = await getVerifiedSessionPrincipal();
	return principal ? (await import("@/server/events/connections")).saveEventS3Connection(principal, creatorId, input) : unauthenticated;
}

export async function getEventReviewAction(creatorId: string, eventId: string) {
	const principal = await getVerifiedSessionPrincipal();
	return principal ? (await import("@/server/events/review")).readAwardReview(principal, creatorId, eventId) : unauthenticated;
}
export async function nominateEventCandidatesAction(creatorId: string, eventId: string, categoryId: string, ids: string[]) {
	const principal = await getVerifiedSessionPrincipal();
	return principal ? (await import("@/server/events/review")).nominateAwardCandidates(principal, creatorId, eventId, categoryId, ids) : unauthenticated;
}
export async function groupEventCandidatesAction(creatorId: string, eventId: string, categoryId: string, ids: string[], title: string) {
	const principal = await getVerifiedSessionPrincipal();
	return principal ? (await import("@/server/events/review")).groupAwardCandidates(principal, creatorId, eventId, categoryId, ids, title) : unauthenticated;
}
export async function releaseEventReviewAction(creatorId: string, eventId: string) {
	const principal = await getVerifiedSessionPrincipal();
	return principal ? (await import("@/server/events/review")).releaseAwardReview(principal, creatorId, eventId) : unauthenticated;
}

export async function completeEventGoogleConnectionAction(provider: "drive" | "youtube", intent: string) {
	const principal = await getVerifiedSessionPrincipal();
	if (!principal) return unauthenticated;
	return { ok: true as const, connection: await (await import("@/server/events/connections")).completeEventGoogleConnection(principal, provider, intent) };
}

export async function setEventDataResultAction(creatorId: string, eventId: string, categoryId: string, input: unknown) {
	const principal = await getVerifiedSessionPrincipal();
	return principal ? (await import("@/server/events/freeze")).setAwardDataResult(principal, creatorId, eventId, categoryId, input) : unauthenticated;
}

export async function addEventTeamCandidateAction(creatorId: string, eventId: string, categoryId: string, input: unknown) {
	const principal = await getVerifiedSessionPrincipal();
	return principal ? (await import("@/server/events/review")).addAwardTeamCandidate(principal, creatorId, eventId, categoryId, input) : unauthenticated;
}
export async function searchEventTeamSourcesAction(creatorId: string, eventId: string, categoryId: string, query: string) {
	const principal = await getVerifiedSessionPrincipal();
	if (!principal) return unauthenticated;
	const event = await readAwardEvent(principal, creatorId, eventId);
	if (!event.ok) return event;
	const category = event.event.configuration.categories.find((c) => c.id === categoryId);
	if (!category || category.selection === "data") return { ok: false as const, code: "INVALID_INPUT" as const };
	try {
		return { ok: true as const, items: await (await import("@/server/events/sources")).searchAwardSources(creatorId, category, query) };
	} catch {
		return { ok: false as const, code: "PROVIDER_UNAVAILABLE" as const };
	}
}

export async function saveEventPresentationAction(creatorId: string, eventId: string, revision: number, input: unknown) {
	const principal = await getVerifiedSessionPrincipal();
	return principal ? (await import("@/server/events/persistence")).saveAwardPresentation(principal, creatorId, eventId, revision, input) : unauthenticated;
}

export async function getEventPresenterAction(eventId: string, secret: string) {
	return (await import("@/server/events/presenter")).readAwardPresenter(eventId, secret);
}
export async function publishEventPresenterResultsAction(eventId: string, secret: string) {
	return (await import("@/server/events/presenter")).publishAwardPresenterResults(eventId, secret);
}

export async function connectEventChatAction(eventId: string, secret: string) {
	return (await import("@/server/events/chat")).connectAwardChat(eventId, secret);
}
export async function pollEventChatAction(eventId: string, secret: string) {
	return (await import("@/server/events/chat")).pollAwardChat(eventId, secret);
}
export async function listPublicEventsAction() {
	return (await import("@/server/events/discovery")).listPublicAwardEvents();
}
export async function getEventTiesAction(creatorId: string, eventId: string) {
	const principal = await getVerifiedSessionPrincipal();
	return principal ? (await import("@/server/events/ties")).readAwardTieResults(principal, creatorId, eventId) : unauthenticated;
}
export async function chooseEventTieWinnerAction(creatorId: string, eventId: string, categoryId: string, candidateId: string) {
	const principal = await getVerifiedSessionPrincipal();
	return principal ? (await import("@/server/events/ties")).chooseAwardTieWinner(principal, creatorId, eventId, categoryId, candidateId) : unauthenticated;
}
