import { z } from "zod";

const instant = z.iso.datetime({ offset: true });
export const eventScheduleSchema = z
	.object({
		submissionsStart: instant,
		submissionsEnd: instant,
		votingStart: instant,
		votingEnd: instant,
		timezone: z.string().refine((value) => {
			try {
				new Intl.DateTimeFormat("en", { timeZone: value });
				return true;
			} catch {
				return false;
			}
		}, "Choose a valid timezone."),
		reviewRequired: z.boolean(),
	})
	.strict()
	.refine((s) => Date.parse(s.submissionsStart) < Date.parse(s.submissionsEnd) && Date.parse(s.submissionsEnd) <= Date.parse(s.votingStart) && Date.parse(s.votingStart) < Date.parse(s.votingEnd), "Keep the event phases in chronological order.");
export type EventSchedule = z.infer<typeof eventScheduleSchema>;
export type EventPhase = "draft" | "announcement" | "submissions" | "review" | "voting" | "closed" | "results";
export type EventPhaseState = { schedule: EventSchedule; published: boolean; resultsPublished: boolean; reviewReleased: boolean };

export function eventPhase(event: EventPhaseState, now = new Date()): EventPhase {
	if (!event.published) return "draft";
	if (event.resultsPublished) return "results";
	const time = now.getTime();
	if (time < Date.parse(event.schedule.submissionsStart)) return "announcement";
	if (time < Date.parse(event.schedule.submissionsEnd)) return "submissions";
	if (time >= Date.parse(event.schedule.votingEnd)) return "closed";
	if (time < Date.parse(event.schedule.votingStart) || (event.schedule.reviewRequired && !event.reviewReleased)) return "review";
	return "voting";
}
export function canAcceptVotes(event: EventPhaseState, now = new Date()) {
	return eventPhase(event, now) === "voting";
}
