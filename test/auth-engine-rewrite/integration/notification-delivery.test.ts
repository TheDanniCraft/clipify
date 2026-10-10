/** @jest-environment node */
const claim = jest.fn(),
	complete = jest.fn(),
	fail = jest.fn(),
	applies = jest.fn(),
	send = jest.fn(),
	render = jest.fn();
jest.mock("@/server/notifications/outbox", () => ({ claimDatabaseNotifications: (...a: unknown[]) => claim(...a), completeDatabaseNotification: (...a: unknown[]) => complete(...a), failDatabaseNotification: (...a: unknown[]) => fail(...a) }));
jest.mock("@/server/notifications/eligibility", () => ({ notificationStillApplies: (...a: unknown[]) => applies(...a) }));
jest.mock("@/auth/transactional-mail", () => ({
	UseSendTransactionalMailAdapter: class {
		send(...a: unknown[]) {
			return send(...a);
		}
	},
}));
jest.mock("@/server/notifications/templates/identity-security", () => ({ renderIdentitySecurityEmail: (...a: unknown[]) => render(...a) }));
import { deliverDueNotifications } from "@/server/notifications/delivery";
const record = { id: "notification-1", event_type: "security", recipient: "alex@example.test", template_version: "identity-security-v1", payload: { type: "security", change: "passkey-added" }, dedupe_key: "security:1" };
beforeEach(() => {
	jest.clearAllMocks();
	claim.mockResolvedValue([record]);
	applies.mockResolvedValue(true);
	render.mockResolvedValue({ subject: "Security", html: "<p>Changed</p>", text: "Changed", templateVersion: "identity-security-v1" });
	send.mockResolvedValue("provider-1");
});
test("delivers queued events with a stable provider idempotency key and acknowledges the owning claim", async () => {
	await deliverDueNotifications();
	expect(send).toHaveBeenCalledWith(record.recipient, expect.objectContaining({ text: "Changed" }), "outbox:notification-1");
	expect(complete).toHaveBeenCalledWith(expect.objectContaining({ id: record.id, workerId: expect.any(String), providerMessageId: "provider-1" }));
	expect(fail).not.toHaveBeenCalled();
});
test("discards recovered or obsolete reminders without sending mail", async () => {
	applies.mockResolvedValue(false);
	await deliverDueNotifications();
	expect(send).not.toHaveBeenCalled();
	expect(fail).toHaveBeenCalledWith(expect.objectContaining({ permanent: true, error: "NOTIFICATION_NO_LONGER_APPLIES" }));
});
test("a provider failure is retried without claiming success and does not prevent another delivery", async () => {
	claim.mockResolvedValue([record, { ...record, id: "notification-2" }]);
	send.mockRejectedValueOnce(new Error("provider unavailable"));
	await deliverDueNotifications();
	expect(fail).toHaveBeenCalledWith(expect.objectContaining({ id: "notification-1", permanent: false }));
	expect(complete).toHaveBeenCalledWith(expect.objectContaining({ id: "notification-2" }));
});
