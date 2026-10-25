/** @jest-environment node */
export {};

let mockVisitorIp = "192.0.2.1";
jest.mock("next/headers", () => ({ headers: async () => ({ get: (name: string) => (name === "x-forwarded-for" ? mockVisitorIp : null) }) }));
jest.mock("@actions/utils", () => ({ isCoolify: async () => false }));

describe("clip playback capacity with the installed rate limiter", () => {
	beforeEach(() => {
		jest.resetModules();
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2026-10-25T00:00:00.000Z"));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("preserves runtime capacity across staggered public and demo reset boundaries", async () => {
		const { canResolvePublicClipPlayback, canResolveTrustedClipPlayback, canResolveDemoClipPlayback } = await import("@actions/rateLimit");
		const ownerId = "owner-real-window";
		const publicRequest = async (index: number) => {
			mockVisitorIp = `192.0.2.${index}`;
			return canResolvePublicClipPlayback(ownerId);
		};
		const demoRequest = async (index: number) => {
			mockVisitorIp = `198.51.100.${index}`;
			return canResolveDemoClipPlayback(ownerId);
		};

		await expect(canResolveTrustedClipPlayback(ownerId)).resolves.toBe(true);
		await jest.advanceTimersByTimeAsync(30_000);
		await expect(publicRequest(1)).resolves.toBe(true);
		await expect(demoRequest(1)).resolves.toBe(true);
		await jest.advanceTimersByTimeAsync(30_001);
		await expect(canResolveTrustedClipPlayback(ownerId)).resolves.toBe(true);
		await jest.advanceTimersByTimeAsync(28_999);
		for (let index = 2; index <= 60; index++) await expect(publicRequest(index)).resolves.toBe(true);
		for (let index = 2; index <= 30; index++) await expect(demoRequest(index)).resolves.toBe(true);
		await jest.advanceTimersByTimeAsync(1_001);
		await expect(publicRequest(61)).resolves.toBe(true);
		await expect(demoRequest(31)).resolves.toBe(true);
		await expect(publicRequest(62)).resolves.toBe(false);
		await expect(demoRequest(32)).resolves.toBe(false);
		for (let index = 0; index < 59; index++) await expect(canResolveTrustedClipPlayback(ownerId)).resolves.toBe(true);
		await expect(canResolveTrustedClipPlayback(ownerId)).resolves.toBe(false);
	});

	it("does not reset owner capacity at a wall-clock minute boundary", async () => {
		const { canResolveTrustedClipPlayback } = await import("@actions/rateLimit");
		const ownerId = "owner-boundary-burst";
		await jest.advanceTimersByTimeAsync(59_900);
		for (let index = 0; index < 60; index++) await expect(canResolveTrustedClipPlayback(ownerId)).resolves.toBe(true);
		await jest.advanceTimersByTimeAsync(200);
		await expect(canResolveTrustedClipPlayback(ownerId)).resolves.toBe(false);
		await jest.advanceTimersByTimeAsync(59_801);
		await expect(canResolveTrustedClipPlayback(ownerId)).resolves.toBe(true);
	});
});
