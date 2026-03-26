/** @jest-environment node */
export {};

const consume = jest.fn();
const RateLimiterMemory = jest.fn().mockImplementation(() => ({
	consume: (...args: unknown[]) => consume(...args),
}));
const headers = jest.fn();

let headerValues: Record<string, string | null> = {};

jest.mock("rate-limiter-flexible", () => ({
	RateLimiterMemory,
}));

jest.mock("next/headers", () => ({
	headers: (...args: unknown[]) => headers(...args),
}));

const isCoolifyMock = jest.fn();
jest.mock("@/app/actions/utils", () => ({
	isCoolify: () => isCoolifyMock(),
}));

async function loadRateLimit() {
	jest.resetModules();
	return import("@/app/actions/rateLimit");
}

describe("actions/rateLimit", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		headerValues = {};
		headers.mockResolvedValue({
			get: (name: string) => headerValues[name.toLowerCase()] ?? null,
		});
		isCoolifyMock.mockResolvedValue(false);
		delete process.env.VERCEL;
	});

	it("extracts the first forwarded ip when x-forwarded-for contains multiple addresses", async () => {
		headerValues["x-forwarded-for"] = "203.0.113.1, 10.0.0.1";
		const { getUserIP } = await loadRateLimit();
		await expect(getUserIP()).resolves.toBe("203.0.113.1");
	});

	it("identifies Cloudflare by cf-ray and trusts cf-connecting-ip", async () => {
		headerValues["cf-ray"] = "some-ray-id";
		headerValues["cf-connecting-ip"] = "1.2.3.4";
		headerValues["x-forwarded-for"] = "8.8.8.8, 1.2.3.4";
		const { getUserIP } = await loadRateLimit();
		await expect(getUserIP()).resolves.toBe("1.2.3.4");
	});

	it("identifies Vercel and trusts the first x-forwarded-for entry", async () => {
		process.env.VERCEL = "1";
		headerValues["x-forwarded-for"] = "5.6.7.8, 10.0.0.1";
		const { getUserIP } = await loadRateLimit();
		await expect(getUserIP()).resolves.toBe("5.6.7.8");
	});

	it("identifies Coolify and trusts x-real-ip", async () => {
		isCoolifyMock.mockResolvedValue(true);
		headerValues["x-real-ip"] = "9.10.11.12";
		const { getUserIP } = await loadRateLimit();
		await expect(getUserIP()).resolves.toBe("9.10.11.12");
	});

	it("identifies DigitalOcean and trusts do-connecting-ip", async () => {
		headerValues["do-connecting-ip"] = "1.2.3.4";
		const { getUserIP } = await loadRateLimit();
		await expect(getUserIP()).resolves.toBe("1.2.3.4");
	});

	it("identifies Fastly and trusts fastly-client-ip", async () => {
		headerValues["fastly-client-ip"] = "2.3.4.5";
		const { getUserIP } = await loadRateLimit();
		await expect(getUserIP()).resolves.toBe("2.3.4.5");
	});

	it("identifies Akamai and trusts true-client-ip", async () => {
		headerValues["true-client-ip"] = "3.4.5.6";
		const { getUserIP } = await loadRateLimit();
		await expect(getUserIP()).resolves.toBe("3.4.5.6");
	});

	it("identifies Google Cloud and trusts x-appengine-user-ip", async () => {
		headerValues["x-appengine-user-ip"] = "4.5.6.7";
		const { getUserIP } = await loadRateLimit();
		await expect(getUserIP()).resolves.toBe("4.5.6.7");
	});

	it("falls back to x-real-ip and then localhost in unknown environments", async () => {
		const { getUserIP } = await loadRateLimit();
		headerValues["x-real-ip"] = "198.51.100.7";
		await expect(getUserIP()).resolves.toBe("198.51.100.7");

		headerValues["x-real-ip"] = null;
		await expect(getUserIP()).resolves.toBe("127.0.0.1");
	});

	it("supports custom identifier (like User ID) for rate limiting", async () => {
		consume.mockResolvedValue({ remainingPoints: 0 });
		const { tryRateLimit } = await loadRateLimit();

		await tryRateLimit({ key: "action", points: 5, duration: 60, identifier: "user_123" });

		expect(consume).toHaveBeenCalledWith("user_123", 1);
	});

	it("reuses the same limiter instance for repeated calls with the same key", async () => {
		consume.mockResolvedValue({ remainingPoints: 0 });
		const { tryRateLimit } = await loadRateLimit();

		await tryRateLimit({ key: "feedback", points: 2, duration: 60 });
		await tryRateLimit({ key: "feedback", points: 2, duration: 60 });

		expect(RateLimiterMemory).toHaveBeenCalledTimes(1);
		expect(consume).toHaveBeenCalledTimes(2);
	});

	it("returns success states from limiter consume resolve/reject", async () => {
		const { tryRateLimit } = await loadRateLimit();
		consume.mockResolvedValueOnce({ msBeforeNext: 0 });
		const ok = await tryRateLimit({ key: "newsletter", points: 1, duration: 10 });
		expect(ok.success).toBe(true);

		consume.mockRejectedValueOnce({ msBeforeNext: 20_000 });
		const blocked = await tryRateLimit({ key: "newsletter", points: 1, duration: 10 });
		expect(blocked.success).toBe(false);
	});

	it("detects rate-limit errors by error name", async () => {
		const { isRatelimitError } = await loadRateLimit();
		const rateError = new Error("too many");
		rateError.name = "RateLimitError";

		await expect(isRatelimitError(rateError)).resolves.toBe(true);
		await expect(isRatelimitError(new Error("other"))).resolves.toBe(false);
		await expect(isRatelimitError("oops")).resolves.toBe(false);
	});
});
