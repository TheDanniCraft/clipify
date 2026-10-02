const redirect = jest.fn();
const validateAuth = jest.fn();
const getAuthSession = jest.fn();
const readCheckoutIntent = jest.fn();

jest.mock("next/navigation", () => ({ redirect: (...args: unknown[]) => redirect(...args) }));
jest.mock("@actions/auth", () => ({ validateAuth: (...args: unknown[]) => validateAuth(...args) }));
jest.mock("@/auth/session", () => ({ getAuthSession: (...args: unknown[]) => getAuthSession(...args) }));
jest.mock("@/server/checkoutIntent", () => ({ readCheckoutIntent: (...args: unknown[]) => readCheckoutIntent(...args) }));
jest.mock("@/app/login/LoginClient", () => ({ __esModule: true, default: () => null }));

describe("app/login/page", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		redirect.mockImplementation(() => {
			throw new Error("NEXT_REDIRECT");
		});
		readCheckoutIntent.mockResolvedValue(null);
		validateAuth.mockResolvedValue({ id: "creator-1" });
		getAuthSession.mockResolvedValue({ session: { id: "session-1" } });
	});

	it("honors a safe return URL for an already authenticated user", async () => {
		const LoginPage = (await import("@/app/login/page")).default;

		await expect(LoginPage({ searchParams: Promise.resolve({ returnUrl: "/dashboard/agency" }) })).rejects.toThrow("NEXT_REDIRECT");

		expect(redirect).toHaveBeenCalledWith("/dashboard/agency");
	});

	it("rejects a protocol-relative return URL", async () => {
		const LoginPage = (await import("@/app/login/page")).default;

		await expect(LoginPage({ searchParams: Promise.resolve({ returnUrl: "//example.com" }) })).rejects.toThrow("NEXT_REDIRECT");

		expect(redirect).toHaveBeenCalledWith("/dashboard");
	});
});
