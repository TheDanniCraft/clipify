/** @jest-environment node */
jest.mock("server-only", () => ({}));
const mockReceipt = jest.fn();
const mockLimit = jest.fn();
jest.mock("@/server/runner/terminal", () => ({ acknowledgeRevokedExecution: (...args: unknown[]) => mockReceipt(...args) }));
jest.mock("@actions/rateLimit", () => ({ tryRateLimit: (...args: unknown[]) => mockLimit(...args) }));
jest.mock("@lib/sentryServer", () => ({ captureUnexpectedError: jest.fn() }));
import { POST } from "@/app/api/runner/terminal/route";
import { captureUnexpectedError } from "@lib/sentryServer";
import { createHash } from "node:crypto";
const receipt = { admissionId: "dc4d8b82-a751-4828-8a66-d39338137a3f", executionGeneration: "c8754245-74d1-411f-884b-c53d05c303cd", allOutputsClosed: true };
function request(body: string | null = JSON.stringify(receipt), authorization: string | null = "Bearer retired-token") {
	return new Request("http://localhost/api/runner/terminal", { method: "POST", headers: authorization === null ? {} : { authorization }, body });
}
async function check(response: Response, status: number) {
	expect(response.status).toBe(status);
	expect(response.headers.get("cache-control")).toBe("no-store");
	return response.json();
}
beforeEach(() => {
	jest.clearAllMocks();
	mockLimit.mockResolvedValue({ success: true });
	mockReceipt.mockResolvedValue({ accepted: true });
});
test.each([null, "Basic token", "Bearer", "Bearer ", "Bearer two words", `Bearer ${"a".repeat(513)}`])("terminal authentication rejects malformed credentials: %s", async (authorization) => {
	await check(await POST(request(undefined, authorization)), 401);
	expect(mockLimit).not.toHaveBeenCalled();
	expect(mockReceipt).not.toHaveBeenCalled();
});
test("terminal receipts rate-limit a digest without retaining the credential", async () => {
	mockLimit.mockResolvedValue({ success: false });
	const response = await POST(request());
	await check(response, 429);
	expect(response.headers.get("retry-after")).toBe("60");
	expect(mockLimit).toHaveBeenCalledWith({ key: "runner-terminal", points: 12, duration: 60, identifier: createHash("sha256").update("retired-token").digest("hex") });
	expect(mockReceipt).not.toHaveBeenCalled();
});
test.each([null, "{", "[]", JSON.stringify({ ...receipt, allOutputsClosed: false }), JSON.stringify({ ...receipt, admissionId: "not-a-uuid" }), JSON.stringify({ ...receipt, renew: true })])("terminal receipt rejects incomplete or extra authority: %s", async (body) => {
	await check(await POST(request(body)), 400);
	expect(mockReceipt).not.toHaveBeenCalled();
});
test("terminal receipt enforces byte limit before parsing", async () => {
	await check(await POST(request(" ".repeat(65537))), 413);
	expect(mockReceipt).not.toHaveBeenCalled();
});
test("terminal receipt accepts exactly the byte limit", async () => {
	const body = JSON.stringify(receipt).padEnd(65536, " ");
	expect(await check(await POST(request(body)), 200)).toEqual({ accepted: true });
	expect(mockReceipt).toHaveBeenCalledWith("retired-token", receipt);
});
test("terminal receipt rejects unreadable streams", async () => {
	const body = new ReadableStream({
		start(controller) {
			controller.error(new Error("connection interrupted"));
		},
	});
	const req = new Request("http://localhost/api/runner/terminal", { method: "POST", headers: { authorization: "Bearer retired-token" }, body, duplex: "half" } as RequestInit);
	await check(await POST(req), 400);
	expect(mockReceipt).not.toHaveBeenCalled();
});
test("terminal receipt rejects generation or bearer mismatch without exposing details", async () => {
	mockReceipt.mockRejectedValue(new Error("INVALID_TERMINAL_CREDENTIAL"));
	expect(await check(await POST(request()), 401)).toEqual({ error: "Invalid terminal credential" });
	expect(captureUnexpectedError).not.toHaveBeenCalled();
});
test("terminal failures report internally and return a safe response", async () => {
	const error = new Error("database private details");
	mockReceipt.mockRejectedValue(error);
	expect(await check(await POST(request()), 500)).toEqual({ error: "Terminal receipt could not be processed" });
	expect(captureUnexpectedError).toHaveBeenCalledWith(error, "runner-terminal", "acknowledge");
});

test.each(["playback_timeout", "clip_completed", "invalid"])("TDD-US3-EC009: terminal endpoint validates playback outcome %s", async (playbackOutcome) => {
	const payload = { ...receipt, playbackOutcome };
	await check(await POST(request(JSON.stringify(payload))), playbackOutcome === "invalid" ? 400 : 200);
	if (playbackOutcome === "invalid") expect(mockReceipt).not.toHaveBeenCalled();
	else expect(mockReceipt).toHaveBeenCalledWith("retired-token", payload);
});
