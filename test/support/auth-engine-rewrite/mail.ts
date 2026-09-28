export type MailFailureMode = "none" | "transient" | "permanent";

export interface CapturedMail {
	to: string;
	template: string;
	dedupeKey: string;
	payload: Record<string, unknown>;
}

const SECRET_KEYS = /token|secret|password|otp|code|authorization|cookie/i;

export function redactMailPayload(payload: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, SECRET_KEYS.test(key) ? "[REDACTED]" : value]));
}

export class DeterministicMailAdapter {
	readonly sent: CapturedMail[] = [];
	readonly attemptedDedupeKeys = new Set<string>();

	constructor(private readonly failureMode: MailFailureMode = "none") {}

	async send(mail: CapturedMail): Promise<{ messageId: string; duplicate: boolean }> {
		if (this.attemptedDedupeKeys.has(mail.dedupeKey)) return { messageId: `duplicate:${mail.dedupeKey}`, duplicate: true };
		this.attemptedDedupeKeys.add(mail.dedupeKey);
		if (this.failureMode === "transient") throw new Error("mail_transient_failure");
		if (this.failureMode === "permanent") throw new Error("mail_permanent_failure");
		this.sent.push({ ...mail, payload: redactMailPayload(mail.payload) });
		return { messageId: `fixture:${mail.dedupeKey}`, duplicate: false };
	}
}
