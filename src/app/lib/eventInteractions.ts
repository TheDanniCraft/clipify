export type EventInteractionType = "poll" | "prediction";
export type EventInteractionState = {
	type: EventInteractionType;
	id?: string;
	manualCheck?: boolean;
	status: "ACTIVE" | "LOCKED" | "COMPLETED" | "RESOLVED" | "CANCELED" | "TERMINATED" | "ARCHIVED" | "MODERATED" | "SKIPPED";
	endsAt: string;
	outcomes: Record<string, string>;
};
export const eventInteractionScopes = { poll: "channel:manage:polls", prediction: "channel:manage:predictions" } as const;
export function eventInteractionLimit(type: EventInteractionType) {
	return type === "poll" ? 5 : 10;
}
export function eventInteractionFits(type: EventInteractionType, count: number) {
	return count >= 2 && count <= eventInteractionLimit(type);
}
