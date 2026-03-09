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
		cookiesMock.mockResolvedValue({ set: jest.fn() });
		getBaseUrl.mockResolvedValue(new URL("https://clipify.us"));
		isPreview.mockResolvedValue(false);
		safeReturnUrl.mockResolvedValue("/dashboard");
		randomUUID.mockReturnValue("nonce-1");
		sign.mockReturnValue("signed-state");
	});

	it("redirects to Twitch OAuth with expected params and sets nonce cookie", async () => {
		const { GET } = await import("@/app/auth/route");
		const response = await GET({ url: "https://clipify.us/auth?returnUrl=%2Fdashboard" } as never);

		expect(response.status).toBe(307);
		const location = response.headers.get("location");
		expect(location).toContain("https://id.twitch.tv/oauth2/authorize");
		expect(location).toContain("client_id=client_id");
		expect(location).toContain("state=signed-state");
		expect(location).toContain("force_verify=true");

		const cookieStore = await cookiesMock.mock.results[0]?.value;
		expect(cookieStore.set).toHaveBeenCalledWith(
			"auth_nonce",
			"nonce-1",
			expect.objectContaining({
				httpOnly: true,
				sameSite: "lax",
			}),
		);
	});
});
