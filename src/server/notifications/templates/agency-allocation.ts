export type AgencyAllocationNotice = "granted" | "removal-scheduled" | "removal-3d" | "removal-1d" | "ended";

export interface AgencyAllocationNotificationIntent {
	boundary: AgencyAllocationNotice;
	recipient: string;
	templateVersion: "agency-allocation-v1";
	scheduledAt: Date;
	dedupeKey: string;
	payload: { agencyName: string; effectiveAt: string };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildAgencyAllocationRemovalIntents(input: { allocationId: string; recipient: string; agencyName: string; requestedAt: Date; endsAt: Date }): AgencyAllocationNotificationIntent[] {
	return [
		{ boundary: "removal-scheduled", scheduledAt: input.requestedAt },
		{ boundary: "removal-3d", scheduledAt: new Date(input.endsAt.getTime() - 3 * DAY_MS) },
		{ boundary: "removal-1d", scheduledAt: new Date(input.endsAt.getTime() - DAY_MS) },
		{ boundary: "ended", scheduledAt: input.endsAt },
	].map(({ boundary, scheduledAt }) => ({
		boundary: boundary as AgencyAllocationNotice,
		recipient: input.recipient,
		templateVersion: "agency-allocation-v1",
		scheduledAt,
		dedupeKey: `agency-allocation:${input.allocationId}:${boundary}`,
		payload: { agencyName: input.agencyName, effectiveAt: input.endsAt.toISOString() },
	}));
}

export function buildAgencyAllocationGrantIntent(input: { allocationId: string; recipient: string; agencyName: string; effectiveAt: Date }): AgencyAllocationNotificationIntent {
	return {
		boundary: "granted",
		recipient: input.recipient,
		templateVersion: "agency-allocation-v1",
		scheduledAt: input.effectiveAt,
		dedupeKey: `agency-allocation:${input.allocationId}:granted`,
		payload: { agencyName: input.agencyName, effectiveAt: input.effectiveAt.toISOString() },
	};
}

export function renderAgencyAllocationNotification(boundary: AgencyAllocationNotice, input: { agencyName: string; effectiveAt: Date }) {
	if (boundary === "granted") return { subject: "Your agency-funded Clipify Pro access is active", body: `${input.agencyName} granted Pro access to your creator account.` };
	if (boundary === "ended") return { subject: "Your agency-funded Clipify Pro access ended", body: `Agency-funded access from ${input.agencyName} ended. Your creator-owned benefits and data remain unchanged.` };
	const remaining = boundary === "removal-scheduled" ? "7 days" : boundary === "removal-3d" ? "3 days" : "1 day";
	return { subject: `Agency-funded Clipify Pro access ends in ${remaining}`, body: `${input.agencyName} scheduled your agency-funded access to end on ${input.effectiveAt.toISOString()}. Your data and creator-owned benefits will remain.` };
}
