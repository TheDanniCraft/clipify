/** @jest-environment node */
jest.mock("server-only", () => ({}));
jest.mock("@/db/client", () => ({ db: {} }));
import { subscribeOverlayReward } from "@/server/resources/overlay-effects";
const savedEnvironment = { ...process.env };
const originalFetch = globalThis.fetch;
beforeEach(() => {
	process.env = { ...savedEnvironment, IS_PREVIEW: "false", TWITCH_CLIENT_ID: "isolated-client", TWITCH_CLIENT_SECRET: "isolated-client-secret", TWITCH_EVENTSUB_URL: "https://fixture.example.invalid/eventsub", WEBHOOK_SECRET: "isolated-webhook-secret" };
});
afterEach(() => {
	process.env = { ...savedEnvironment };
	globalThis.fetch = originalFetch;
});
function rejectingBody() {
	const cancel = jest.fn(async () => {
		throw new Error("controlled stream cleanup failure");
	});
	const pull = jest.fn();
	return { body: new ReadableStream({ cancel, pull }, { highWaterMark: 0 }), cancel, pull };
}
describe("TDD-OVERLAY-EFFECT-011 provider stream cancellation failures", () => {
	test("failed app authorization remains a fixed retryable failure even when cleanup rejects", async () => {
		const stream = rejectingBody();
		const fetcher = jest.fn().mockResolvedValue(new Response(stream.body, { status: 401 }));
		globalThis.fetch = fetcher;
		await expect(subscribeOverlayReward("creator", "RewardOne")).rejects.toThrow("provider_unavailable");
		await Promise.resolve();
		expect(stream.cancel).toHaveBeenCalledTimes(1);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
	test("accepted subscription is not retried because its unused response cleanup rejects", async () => {
		const stream = rejectingBody();
		const fetcher = jest
			.fn()
			.mockResolvedValueOnce(Response.json({ access_token: "isolated-app-token", token_type: "bearer", expires_in: 3600 }))
			.mockResolvedValueOnce(new Response(stream.body, { status: 202 }));
		globalThis.fetch = fetcher;
		await expect(subscribeOverlayReward("creator", "RewardOne")).resolves.toBeUndefined();
		await Promise.resolve();
		expect(stream.cancel).toHaveBeenCalledTimes(1);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});
	test("oversized declared token body is rejected before reading even when cancellation fails", async () => {
		const stream = rejectingBody();
		const fetcher = jest.fn().mockResolvedValue(new Response(stream.body, { headers: { "Content-Length": "65537" } }));
		globalThis.fetch = fetcher;
		await expect(subscribeOverlayReward("creator", "RewardOne")).rejects.toThrow("provider_unavailable");
		await Promise.resolve();
		expect(stream.pull).not.toHaveBeenCalled();
		expect(stream.cancel).toHaveBeenCalledTimes(1);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
	test("streamed token overflow stops before the next chunk and remains retryable", async () => {
		let reads = 0;
		const cancel = jest.fn(async () => {
			throw new Error("controlled overflow cleanup failure");
		});
		const body = new ReadableStream(
			{
				pull(controller) {
					reads++;
					controller.enqueue(new Uint8Array(reads === 1 ? 32768 : 32769));
				},
				cancel,
			},
			{ highWaterMark: 0 },
		);
		const fetcher = jest.fn().mockResolvedValue(new Response(body));
		globalThis.fetch = fetcher;
		await expect(subscribeOverlayReward("creator", "RewardOne")).rejects.toThrow("provider_unavailable");
		await Promise.resolve();
		expect(reads).toBe(2);
		expect(cancel).toHaveBeenCalledTimes(1);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});
});
