/** @jest-environment node */
export {};

const nextMock = jest.fn(() => ({ kind: "next" }));
const redirectMock = jest.fn((url: URL) => ({ kind: "redirect", url: url.toString() }));
const authUser = jest.fn();
const getAuthActorContext = jest.fn();
const getAuthSession = jest.fn();

jest.mock("next/server", () => ({
	NextResponse: {
		next: () => nextMock(),
		redirect: (url: URL) => redirectMock(url),
	},
}));

jest.mock("@actions/auth", () => ({
	authUser: (...args: unknown[]) => authUser(...args),
}));

jest.mock("@/auth/session", () => ({
	getAuthActorContext: (...args: unknown[]) => getAuthActorContext(...args),
	getAuthSession: (...args: unknown[]) => getAuthSession(...args),
}));

describe("proxy", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		authUser.mockResolvedValue({ kind: "auth" });
		getAuthActorContext.mockResolvedValue(null);
		getAuthSession.mockResolvedValue(null);
	});

	it("redirects unauthenticated users to auth flow", async () => {
		const { proxy } = await import("@/proxy");
		const request = {
			cookies: { get: () => undefined },
			nextUrl: { pathname: "/dashboard" },
			url: "https://clipify.us/dashboard",
		} as unknown as Parameters<typeof proxy>[0];

		await expect(proxy(request)).resolves.toEqual({ kind: "auth" });
		expect(authUser).toHaveBeenCalledWith("/dashboard");
	});

	it("allows non-admin routes with valid token cookie", async () => {
		getAuthActorContext.mockResolvedValue({ user: { role: "user" } });
		const { proxy } = await import("@/proxy");
		const request = {
			cookies: { get: () => ({ value: "jwt-token" }) },
			nextUrl: { pathname: "/dashboard" },
			url: "https://clipify.us/dashboard",
		} as unknown as Parameters<typeof proxy>[0];

		await expect(proxy(request)).resolves.toEqual({ kind: "next" });
		expect(getAuthActorContext).toHaveBeenCalled();
	});

	it("routes email-only agency identities to their supported dashboard", async () => {
		getAuthSession.mockResolvedValue({ user: { id: "agency-user" } });
		const { proxy } = await import("@/proxy");
		const dashboardRequest = { nextUrl: { pathname: "/dashboard" }, url: "https://clipify.us/dashboard" } as unknown as Parameters<typeof proxy>[0];
		const agencyRequest = { nextUrl: { pathname: "/dashboard/agency" }, url: "https://clipify.us/dashboard/agency" } as unknown as Parameters<typeof proxy>[0];

		await expect(proxy(dashboardRequest)).resolves.toEqual({ kind: "redirect", url: "https://clipify.us/dashboard/agency" });
		await expect(proxy(agencyRequest)).resolves.toEqual({ kind: "next" });
	});

	it("requires valid decoded token for admin routes", async () => {
		const { proxy } = await import("@/proxy");
		const request = {
			cookies: { get: () => ({ value: "jwt-token" }) },
			nextUrl: { pathname: "/admin" },
			url: "https://clipify.us/admin",
		} as unknown as Parameters<typeof proxy>[0];

		await expect(proxy(request)).resolves.toEqual({ kind: "auth" });
		expect(authUser).toHaveBeenCalledWith("/admin");
	});

	it("redirects non-admin users away from admin routes", async () => {
		getAuthActorContext.mockResolvedValue({ user: { id: "user-1", role: "user" } });
		const { proxy } = await import("@/proxy");
		const request = {
			cookies: { get: () => ({ value: "jwt-token" }) },
			nextUrl: { pathname: "/admin/settings" },
			url: "https://clipify.us/admin/settings",
		} as unknown as Parameters<typeof proxy>[0];

		await expect(proxy(request)).resolves.toEqual({ kind: "redirect", url: "https://clipify.us/dashboard" });
		expect(redirectMock).toHaveBeenCalled();
	});

	it("allows admins into admin routes", async () => {
		getAuthActorContext.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
		const { proxy } = await import("@/proxy");
		const request = {
			cookies: { get: () => ({ value: "jwt-token" }) },
			nextUrl: { pathname: "/admin" },
			url: "https://clipify.us/admin",
		} as unknown as Parameters<typeof proxy>[0];

		await expect(proxy(request)).resolves.toEqual({ kind: "next" });
	});

	it("redirects a suspended creator to the authenticated recovery route", async () => {
		getAuthActorContext.mockResolvedValue({ accountStatus: "suspended", user: { id: "user-1", role: "user" } });
		const { proxy } = await import("@/proxy");
		const request = { nextUrl: { pathname: "/dashboard" }, url: "https://clipify.us/dashboard" } as unknown as Parameters<typeof proxy>[0];

		await expect(proxy(request)).resolves.toEqual({ kind: "redirect", url: "https://clipify.us/dashboard/settings/account/recovery" });
	});

	it("allows a suspended creator to open only the recovery route", async () => {
		getAuthActorContext.mockResolvedValue({ accountStatus: "suspended", user: { id: "user-1", role: "user" } });
		const { proxy } = await import("@/proxy");
		const request = { nextUrl: { pathname: "/dashboard/settings/account/recovery" }, url: "https://clipify.us/dashboard/settings/account/recovery" } as unknown as Parameters<typeof proxy>[0];

		await expect(proxy(request)).resolves.toEqual({ kind: "next" });
	});
});
