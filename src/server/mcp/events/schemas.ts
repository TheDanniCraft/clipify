import { z } from "zod";
import { eventInputSchema, eventSlideSchema, awardPresentationSchema } from "@/app/lib/eventConfiguration";
const creatorId = z.string().regex(/^[A-Za-z0-9_-]{1,200}$/),
	id = z.uuid(),
	target = { creatorId, eventId: id },
	category = { ...target, categoryId: id },
	candidateIds = z
		.array(id)
		.max(1000)
		.refine((ids) => new Set(ids).size === ids.length),
	revision = z.number().int().positive();
export const eventToolSchemas = {
	list_events: z.object({ creatorId }).strict(),
	get_event: z.object(target).strict(),
	create_event: z.object({ creatorId, configuration: eventInputSchema }).strict(),
	update_event: z.object({ ...target, expectedRevision: revision, configuration: eventInputSchema }).strict(),
	update_event_presentation: z.object({ ...target, expectedRevision: revision, slides: z.array(eventSlideSchema).max(500), presentation: awardPresentationSchema }).strict(),
	publish_event: z.object({ ...target, expectedRevision: revision }).strict(),
	publish_event_results: z.object(target).strict(),
	rotate_event_presenter: z.object(target).strict(),
	get_event_review: z.object(target).strict(),
	nominate_event_candidates: z.object({ ...category, candidateIds }).strict(),
	group_event_candidates: z.object({ ...category, candidateIds: candidateIds.refine((ids) => ids.length >= 2), title: z.string().trim().min(1).max(160) }).strict(),
	release_event_review: z.object(target).strict(),
	add_event_candidate: z.object({ ...category, proposal: z.object({ reference: z.string().max(2048).optional(), title: z.string().max(160).optional(), description: z.string().max(5000).optional() }).strict() }).strict(),
	set_event_data_result: z.object({ ...category, result: z.object({ title: z.string().trim().min(1).max(160), description: z.string().max(5000).default(""), value: z.number().finite().optional(), reference: z.string().max(2048).optional() }).strict() }).strict(),
	get_event_ties: z.object(target).strict(),
	choose_event_tie_winner: z.object({ ...category, candidateId: id }).strict(),
};
export type EventToolName = keyof typeof eventToolSchemas;
export const eventToolPermissions = {
	list_events: "event:read",
	get_event: "event:read",
	create_event: "event:create",
	update_event: "event:update",
	update_event_presentation: "event:update",
	publish_event: "event:publish",
	publish_event_results: "event:publish",
	rotate_event_presenter: "event-presenter:rotate",
	get_event_review: "event:review",
	nominate_event_candidates: "event:review",
	group_event_candidates: "event:review",
	release_event_review: "event:review",
	add_event_candidate: "event:review",
	set_event_data_result: "event:review",
	get_event_ties: "event:review",
	choose_event_tie_winner: "event:review",
} as const;
export function eventToolAnnotations(name: EventToolName) {
	return {
		readOnlyHint: name.startsWith("get_") || name.startsWith("list_"),
		destructiveHint: ["update_event", "update_event_presentation", "nominate_event_candidates", "group_event_candidates", "release_event_review", "publish_event", "publish_event_results", "rotate_event_presenter", "set_event_data_result", "choose_event_tie_winner"].includes(name),
		idempotentHint: !["create_event", "add_event_candidate", "group_event_candidates", "rotate_event_presenter"].includes(name),
		openWorldHint: ["add_event_candidate", "set_event_data_result"].includes(name),
	};
}
