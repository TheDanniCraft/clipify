/** @jest-environment node */
const mockControl = jest.fn();
jest.mock("@/server/resources/runners", () => ({ controlStreamSession: (...args: unknown[]) => mockControl(...args) }));
import { resumeRunnerScheduleOccurrenceForPrincipal } from "@/server/runner/schedules";
import { resourceFailure } from "@/server/resources/errors";
const principal = { kind: "session" as const, authUserId: "actor", sessionId: "session", authenticatedAt: new Date() };
const input = { ownerId: "owner", sessionId: "11111111-1111-4111-8111-111111111111", occurrenceId: "original-occurrence", expectedRevision: 3 };
beforeEach(() => mockControl.mockReset());
test("owner Resume preserves occurrence identity and returns the accepted revision to the editor", async () => {
	mockControl.mockResolvedValue({ accepted: true, applied: false, admissionId: "admission", configurationRevision: 4 });
	expect(await resumeRunnerScheduleOccurrenceForPrincipal(principal, input)).toEqual({ success: true, accepted: true, applied: false, admissionId: "admission", configurationRevision: 4 });
	expect(mockControl).toHaveBeenCalledWith(principal, { creatorId: "owner", sessionId: input.sessionId, state: "running", expectedRevision: 3, occurrenceId: "original-occurrence" }, expect.anything(), expect.any(Function));
});
test("a stale Resume returns its conflict as a local action result", async () => {
	mockControl.mockResolvedValue(resourceFailure("CONFLICT"));
	expect(await resumeRunnerScheduleOccurrenceForPrincipal(principal, input)).toMatchObject({ success: false, code: "CONFLICT" });
});
test("a normal Resume restriction signal is translated instead of escaping to the editor", async () => {
	mockControl.mockRejectedValue(new Error("FEATURE_RESTRICTED"));
	expect(await resumeRunnerScheduleOccurrenceForPrincipal(principal, input)).toMatchObject({ success: false, code: "FEATURE_RESTRICTED" });
});
