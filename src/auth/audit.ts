import { randomUUID } from "node:crypto";

export type AuditActionClass = "invitation" | "membership" | "role" | "agency-link" | "allocation" | "sensitive-integration" | "account-deletion";
export type AuditOutcome = "success" | "denied" | "error";

export interface AuditEvent {
	id: string;
	actionClass: AuditActionClass;
	action: string;
	outcome: AuditOutcome;
	reason?: string;
	correlationId: string;
	metadata: Record<string, unknown>;
	occurredAt: Date;
}

const SECRET_KEY = /token|secret|password|credential|authorization|cookie|otp|code/i;

export function redactSecurityValue(value: unknown, key = ""): unknown {
	if (SECRET_KEY.test(key)) return "[REDACTED]";
	if (Array.isArray(value)) return value.map((item) => redactSecurityValue(item));
	if (value && typeof value === "object") {
		return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [childKey, redactSecurityValue(childValue, childKey)]));
	}
	if (typeof value === "string" && /(bearer\s+|authorization:|password=|token=)/i.test(value)) return "[REDACTED]";
	return value;
}

export function appendAuditEvent(events: AuditEvent[], input: Omit<AuditEvent, "id" | "metadata"> & { metadata?: Record<string, unknown> }): AuditEvent {
	const event: AuditEvent = {
		...input,
		id: randomUUID(),
		metadata: redactSecurityValue(input.metadata ?? {}) as Record<string, unknown>,
	};
	events.push(Object.freeze(event));
	return event;
}

export async function writeAuditEvent(input: { actorUserId?: string; actorSessionId?: string; accountOrganizationId?: string; targetType: string; targetId?: string; actionClass: AuditActionClass; action: string; outcome: AuditOutcome; reason?: string; correlationId: string; ipPrefix?: string; userAgentFamily?: string; metadata?: Record<string, unknown>; occurredAt: Date }) {
	const [{ db }, { auditEventsTable }] = await Promise.all([import("@/db/client"), import("@/db/schema")]);
	const [event] = await db
		.insert(auditEventsTable)
		.values({
			actorUserId: input.actorUserId,
			actorSessionId: input.actorSessionId,
			accountOrganizationId: input.accountOrganizationId,
			targetType: input.targetType,
			targetId: input.targetId,
			action: `${input.actionClass}:${input.action}`,
			outcome: input.outcome,
			reason: input.reason,
			correlationId: input.correlationId,
			ipPrefix: input.ipPrefix,
			userAgentFamily: input.userAgentFamily,
			metadata: redactSecurityValue(input.metadata ?? {}) as Record<string, unknown>,
			occurredAt: input.occurredAt,
		})
		.returning();
	return event;
}
