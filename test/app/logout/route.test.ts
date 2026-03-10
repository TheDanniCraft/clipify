/** @jest-environment node */
export {};

const cookiesMock = jest.fn();
const authUser = jest.fn();
const clearAdminViewCookieForAuthFlow = jest.fn();

jest.mock("next/headers", () => ({
	cookies: (...args: unknown[]) => cookiesMock(...args),
}));

jest.mock("@actions/auth", () => ({
	authUser: (...args: unknown[]) => authUser(...args),
	clearAdminViewCookieForAuthFlow: (...args: unknown[]) => clearAdminViewCookieForAuthFlow(...args),
}));

describe("app/logout/route", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		authUser.mockResolvedValue({ ok: true });
		clearAdminViewCookieForAuthFlow.mockResolvedValue(undefined);
		cookiesMock.mockResolvedValue({
			delete: jest.fn(),
		});
	});

	it("clears token and admin-view auth flow state", async () => {
		const { GET } = await import("@/app/logout/route");
		const response = await GET({ nextUrl: new URL("https://clipify.us/logout") } as never);
		expect(clearAdminViewCookieForAuthFlow).toHaveBeenCalledTimes(1);
		expect(authUser).toHaveBeenCalledTimes(1);
		expect(authUser).toHaveBeenCalledWith(undefined, undefined);
		expect(response).toEqual({ ok: true });
	});

	it("passes through logout error to login redirect", async () => {
		const { GET } = await import("@/app/logout/route");
		const response = await GET({ nextUrl: new URL("https://clipify.us/logout?error=accountDisabled") } as never);
		expect(clearAdminViewCookieForAuthFlow).toHaveBeenCalledTimes(1);
		expect(authUser).toHaveBeenCalledWith(undefined, "accountDisabled");
		expect(response).toEqual({ ok: true });
	});
});
