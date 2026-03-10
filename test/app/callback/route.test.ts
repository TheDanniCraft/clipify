/** @jest-environment node */
export {};

const cookiesMock = jest.fn();
const jwtVerify = jest.fn();
const jwtSign = jest.fn();
const exchangeAccesToken = jest.fn();
const setAccessToken = jest.fn();
const touchUser = jest.fn();
const authUser = jest.fn();
const clearAdminViewCookieForAuthFlow = jest.fn();
const getBaseUrl = jest.fn();

jest.mock("next/headers", () => ({
	cookies: (...args: unknown[]) => cookiesMock(...args),
}));

jest.mock("jsonwebtoken", () => ({
	__esModule: true,
	default: {
		verify: (...args: unknown[]) => jwtVerify(...args),
		sign: (...args: unknown[]) => jwtSign(...args),
	},
}));

jest.mock("@actions/twitch", () => ({
	exchangeAccesToken: (...args: unknown[]) => exchangeAccesToken(...args),
}));

jest.mock("@actions/database", () => ({
	setAccessToken: (...args: unknown[]) => setAccessToken(...args),
	touchUser: (...args: unknown[]) => touchUser(...args),
}));

jest.mock("@actions/auth", () => ({
	authUser: (...args: unknown[]) => authUser(...args),
	clearAdminViewCookieForAuthFlow: (...args: unknown[]) => clearAdminViewCookieForAuthFlow(...args),
}));

jest.mock("@actions/utils", () => ({
	getBaseUrl: (...args: unknown[]) => getBaseUrl(...args),
}));

describe("app/callback/route", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		process.env.JWT_SECRET = "jwt-secret";
		cookiesMock.mockResolvedValue({
			get: (name: string) => (name === "auth_nonce" ? { value: "nonce-1" } : undefined),
			set: jest.fn(),
		});
		jwtVerify.mockReturnValue({ nonce: "nonce-1", returnUrl: "/dashboard" });
		exchangeAccesToken.mockResolvedValue({ access_token: "at" });
		setAccessToken.mockResolvedValue({ id: "user-1" });
		jwtSign.mockReturnValue("token");
		getBaseUrl.mockResolvedValue(new URL("https://clipify.us"));
		touchUser.mockResolvedValue(undefined);
		clearAdminViewCookieForAuthFlow.mockResolvedValue(undefined);
	});

	it("cleans admin-view cookies/sessions on successful callback", async () => {
		const { GET } = await import("@/app/callback/route");
		const request = { url: "https://clipify.us/callback?code=abc&state=signed-state" } as Parameters<typeof GET>[0];

		await GET(request);

		expect(clearAdminViewCookieForAuthFlow).toHaveBeenCalledTimes(1);
	});
});
