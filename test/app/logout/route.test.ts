/** @jest-environment node */
export {};

const signOut = jest.fn();
const clearAdminViewCookieForAuthFlow = jest.fn();

jest.mock("@/auth/config", () => ({
	auth: { api: { signOut: (...args: unknown[]) => signOut(...args) } },
}));

jest.mock("@actions/auth", () => ({
	clearAdminViewCookieForAuthFlow: (...args: unknown[]) => clearAdminViewCookieForAuthFlow(...args),
}));

describe("app/logout/route", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		signOut.mockResolvedValue({ headers: { getSetCookie: () => ["better-auth.session_token=; Max-Age=0; Path=/"] } });
		clearAdminViewCookieForAuthFlow.mockResolvedValue(undefined);
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
});
