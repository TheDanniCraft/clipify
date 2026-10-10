/** @jest-environment node */
export {};

const safeReturnUrl = jest.fn();
const signInSocial = jest.fn();

jest.mock("@actions/utils", () => ({
	safeReturnUrl: (...args: unknown[]) => safeReturnUrl(...args),
}));

jest.mock("@/auth/config", () => ({
	auth: {
		api: {
			signInSocial: (...args: unknown[]) => signInSocial(...args),
		},
	},
}));

describe("app/auth/bot route", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		safeReturnUrl.mockResolvedValue("/dashboard");
		signInSocial.mockResolvedValue(Response.redirect("https://id.twitch.tv/oauth2/authorize?state=better-auth"));
	});

	it("starts Twitch OAuth through Better Auth with the extended bot scopes", async () => {
		const { GET } = await import("@/app/auth/bot/route");
		const request = new Request("https://clipify.us/auth/bot?returnUrl=%2Fdashboard");
		const response = await GET(request as never);

		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toContain("https://id.twitch.tv/oauth2/authorize");
		expect(signInSocial).toHaveBeenCalledWith({
			headers: request.headers,
			body: {
				provider: "twitch",
				callbackURL: "/dashboard",
				scopes: ["user:read:email", "channel:read:redemptions", "channel:manage:redemptions", "user:read:chat", "user:write:chat", "user:bot", "channel:bot"],
			},
			asResponse: true,
		});
	});
	it("turns Better Auth's JSON sign-in response into a browser redirect and retains its state cookie", async () => {
		signInSocial.mockResolvedValue(Response.json({ url: "https://id.twitch.tv/oauth2/authorize?state=fixture", redirect: true }, { headers: { Location: "https://id.twitch.tv/oauth2/authorize?state=fixture", "Set-Cookie": "__Secure-better-auth.state=fixture; HttpOnly; Secure; SameSite=Lax" } }));
		const { GET } = await import("@/app/auth/bot/route");
		const response = await GET(new Request("https://clipify.us/auth/bot") as never);
		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe("https://id.twitch.tv/oauth2/authorize?state=fixture");
		expect(response.headers.get("set-cookie")).toContain("__Secure-better-auth.state=fixture");
	});
	it("preserves a failed sign-in response instead of redirecting", async () => {
		const failure = Response.json({ error: "provider_unavailable" }, { status: 503 });
		signInSocial.mockResolvedValue(failure);
		const { GET } = await import("@/app/auth/bot/route");
		expect(await GET(new Request("https://clipify.us/auth/bot") as never)).toBe(failure);
	});
});
