/** @jest-environment node */
export {};

const signOut = jest.fn();
const clearAdminViewCookieForAuthFlow = jest.fn();
const originalCoolifyUrl = process.env.COOLIFY_URL;
const originalCoolifyResourceUuid = process.env.COOLIFY_RESOURCE_UUID;

jest.mock("@/auth/config", () => ({
	auth: { api: { signOut: (...args: unknown[]) => signOut(...args) } },
}));

jest.mock("@actions/auth", () => ({
	clearAdminViewCookieForAuthFlow: (...args: unknown[]) => clearAdminViewCookieForAuthFlow(...args),
}));

describe("app/logout/route", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		process.env.COOLIFY_URL = "https://clipify.us,https://es.clipify.us";
		process.env.COOLIFY_RESOURCE_UUID = "resource-id";
		signOut.mockResolvedValue({ headers: { getSetCookie: () => ["better-auth.session_token=; Max-Age=0; Path=/"] } });
		clearAdminViewCookieForAuthFlow.mockResolvedValue(undefined);
	});

	afterAll(() => {
		if (originalCoolifyUrl === undefined) delete process.env.COOLIFY_URL;
		else process.env.COOLIFY_URL = originalCoolifyUrl;
		if (originalCoolifyResourceUuid === undefined) delete process.env.COOLIFY_RESOURCE_UUID;
		else process.env.COOLIFY_RESOURCE_UUID = originalCoolifyResourceUuid;
	});

	it("revokes the Better Auth session and clears compatibility state", async () => {
		const { GET } = await import("@/app/logout/route");
		const response = await GET({ url: "https://clipify.us/logout", headers: new Headers({ cookie: "better-auth.session_token=session" }) } as never);
		expect(signOut).toHaveBeenCalledWith(expect.objectContaining({ asResponse: true, body: {} }));
		expect(clearAdminViewCookieForAuthFlow).toHaveBeenCalledTimes(1);
		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toBe("https://clipify.us/login");
		expect(response.headers.getSetCookie().join("; ")).toContain("better-auth.session_token=");
		expect(response.headers.getSetCookie().join("; ")).toContain("token=");
	});

	it("redirects through the configured public origin behind the container proxy", async () => {
		const { GET } = await import("@/app/logout/route");
		const response = await GET({ url: "http://0.0.0.0:3000/logout", headers: new Headers() } as never);

		expect(response.headers.get("location")).toBe("https://clipify.us/login");
	});

	it("preserves a safe local return URL while clearing the browser session", async () => {
		const { GET } = await import("@/app/logout/route");
		const response = await GET({ url: "https://clipify.us/logout?returnUrl=%2Fdashboard%2Fsettings%2Faccount%2Frecovery", headers: new Headers({ cookie: "better-auth.session_token=session" }) } as never);

		expect(response.headers.get("location")).toBe("https://clipify.us/login?returnUrl=%2Fdashboard%2Fsettings%2Faccount%2Frecovery");
		expect(response.headers.getSetCookie().join("; ")).toContain("better-auth.session_token=");
	});

	it("rejects an external logout return URL", async () => {
		const { GET } = await import("@/app/logout/route");
		const response = await GET({ url: "https://clipify.us/logout?returnUrl=https%3A%2F%2Fevil.example", headers: new Headers() } as never);

		expect(response.headers.get("location")).toBe("https://clipify.us/login");
	});
});
