/** @jest-environment node */
export {};

const cookiesMock = jest.fn();
const getBaseUrl = jest.fn();
const isPreview = jest.fn();
const safeReturnUrl = jest.fn();
const randomUUID = jest.fn();
const sign = jest.fn();

jest.mock("next/headers", () => ({
	cookies: () => cookiesMock(),
}));

jest.mock("@actions/utils", () => ({
	getBaseUrl: () => getBaseUrl(),
	isPreview: () => isPreview(),
	safeReturnUrl: (...args: unknown[]) => safeReturnUrl(...args),
}));

jest.mock("crypto", () => ({
	randomUUID: () => randomUUID(),
}));

jest.mock("jsonwebtoken", () => ({
	sign: (...args: unknown[]) => sign(...args),
}));

describe("app/auth route", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		process.env.JWT_SECRET = "secret";
		process.env.TWITCH_CLIENT_ID = "client_id";
		delete process.env.TWITCH_FORCE_VERIFY;
		cookiesMock.mockResolvedValue({ set: jest.fn() });
		getBaseUrl.mockResolvedValue(new URL("https://clipify.us"));
		isPreview.mockResolvedValue(false);
		safeReturnUrl.mockResolvedValue("/dashboard");
		randomUUID.mockReturnValue("nonce-1");
		sign.mockReturnValue("signed-state");
	});

	it("redirects the retired creator entrypoint to Better Auth login", async () => {
		const { GET } = await import("@/app/auth/route");
		const response = await GET({ url: "https://clipify.us/auth?returnUrl=%2Fdashboard" } as never);

		expect(response.status).toBe(307);
		const location = response.headers.get("location");
		expect(location).toBe("https://clipify.us/login?returnUrl=%2Fdashboard");
		expect(cookiesMock).not.toHaveBeenCalled();
		expect(sign).not.toHaveBeenCalled();
	});

	it("does not revive legacy OAuth when force verification is configured", async () => {
		process.env.TWITCH_FORCE_VERIFY = "true";
		const { GET } = await import("@/app/auth/route");
		const response = await GET({ url: "https://clipify.us/auth?returnUrl=%2Fdashboard" } as never);
		const location = response.headers.get("location");
		expect(location).toBe("https://clipify.us/login?returnUrl=%2Fdashboard");
	});
});
