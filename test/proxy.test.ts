/** @jest-environment node */
export {};

const nextMock = jest.fn(() => ({ kind: "next" }));
const redirectMock = jest.fn((url: URL) => ({ kind: "redirect", url: url.toString() }));
const authUser = jest.fn();
const getUserFromCookie = jest.fn();

jest.mock("next/server", () => ({
	NextResponse: {
		next: () => nextMock(),
		redirect: (url: URL) => redirectMock(url),
	},
}));

jest.mock("@actions/auth", () => ({
	authUser: (...args: unknown[]) => authUser(...args),
	getUserFromCookie: (...args: unknown[]) => getUserFromCookie(...args),
}));

describe("proxy", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		authUser.mockResolvedValue({ kind: "auth" });
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
		const { proxy } = await import("@/proxy");
		const request = {
			cookies: { get: () => ({ value: "jwt-token" }) },
			nextUrl: { pathname: "/dashboard" },
			url: "https://clipify.us/dashboard",
		} as unknown as Parameters<typeof proxy>[0];

		await expect(proxy(request)).resolves.toEqual({ kind: "next" });
		expect(getUserFromCookie).not.toHaveBeenCalled();
	});

	it("requires valid decoded token for admin routes", async () => {
		getUserFromCookie.mockResolvedValue(undefined);
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
		getUserFromCookie.mockResolvedValue({ id: "user-1", role: "user" });
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
		getUserFromCookie.mockResolvedValue({ id: "admin-1", role: "admin" });
		const { proxy } = await import("@/proxy");
		const request = {
			cookies: { get: () => ({ value: "jwt-token" }) },
			nextUrl: { pathname: "/admin" },
			url: "https://clipify.us/admin",
		} as unknown as Parameters<typeof proxy>[0];

		await expect(proxy(request)).resolves.toEqual({ kind: "next" });
	});
});
