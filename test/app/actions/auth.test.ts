/** @jest-environment node */
export {};

const verify = jest.fn();
const cookies = jest.fn();
const getBaseUrl = jest.fn();
const getUser = jest.fn();
const verifyToken = jest.fn();
const resolveUserEntitlements = jest.fn();

jest.mock("jsonwebtoken", () => ({
	__esModule: true,
	default: {
		verify: (...args: unknown[]) => verify(...args),
	},
}));

jest.mock("next/headers", () => ({
	cookies: (...args: unknown[]) => cookies(...args),
}));

jest.mock("@actions/utils", () => ({
	getBaseUrl: (...args: unknown[]) => getBaseUrl(...args),
}));

jest.mock("@actions/database", () => ({
	getUser: (...args: unknown[]) => getUser(...args),
}));

jest.mock("@actions/twitch", () => ({
	verifyToken: (...args: unknown[]) => verifyToken(...args),
}));

jest.mock("@lib/entitlements", () => ({
	resolveUserEntitlements: (...args: unknown[]) => resolveUserEntitlements(...args),
}));

let cookieValues: Record<string, string> = {};

async function loadAuth() {
	jest.resetModules();
	return import("@/app/actions/auth");
}

describe("actions/auth", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		process.env.JWT_SECRET = "jwt-secret";
		cookieValues = {};
		cookies.mockResolvedValue({
			get: (name: string) => {
				const value = cookieValues[name];
				return value ? { value } : undefined;
			},
		});
		getBaseUrl.mockResolvedValue(new URL("https://clipify.us"));
	});

	it("reads cookie values and returns null for missing cookies", async () => {
		cookieValues.token = "abc";
		const { getCookie } = await loadAuth();
		await expect(getCookie("token")).resolves.toBe("abc");
		await expect(getCookie("missing")).resolves.toBeNull();
	});

	it("parses authenticated users from jwt and handles verification failures", async () => {
		verify.mockReturnValue({ id: "user-1", username: "alice" });
		const { getUserFromCookie } = await loadAuth();
		await expect(getUserFromCookie("jwt-token")).resolves.toEqual({ id: "user-1", username: "alice" });

		verify.mockImplementation(() => {
			throw new Error("invalid");
		});
		await expect(getUserFromCookie("bad-token")).resolves.toBeUndefined();
	});

	it("builds login redirect urls with optional error and returnUrl params", async () => {
		const { authUser } = await loadAuth();
		const response = await authUser("/dashboard/settings", "oauth_failed", "401");
		const location = response.headers.get("location") ?? "";
		expect(location).toContain("https://clipify.us/login");
		expect(location).toContain("error=oauth_failed");
		expect(location).toContain("errorCode=401");
		expect(location).toContain("returnUrl=%2Fdashboard%2Fsettings");
	});

	it("returns false when no auth token exists", async () => {
		const { validateAuth } = await loadAuth();
		await expect(validateAuth(false)).resolves.toBe(false);
	});

	it("returns cookie user immediately when skipUserCheck is enabled", async () => {
		cookieValues.token = "jwt-token";
		verify.mockReturnValue({ id: "user-1", username: "alice" });
		const { validateAuth } = await loadAuth();
		await expect(validateAuth(true)).resolves.toEqual({ id: "user-1", username: "alice" });
	});

	it("fails validation when database user is missing or twitch token is invalid", async () => {
		cookieValues.token = "jwt-token";
		verify.mockReturnValue({ id: "user-1" });
		getUser.mockResolvedValueOnce(null);

		const { validateAuth } = await loadAuth();
		await expect(validateAuth(false)).resolves.toBe(false);

		getUser.mockResolvedValueOnce({ id: "user-1", plan: "free" });
		verifyToken.mockResolvedValueOnce(false);
		await expect(validateAuth(false)).resolves.toBe(false);
	});

	it("returns enriched authenticated user when all checks pass", async () => {
		cookieValues.token = "jwt-token";
		verify.mockReturnValue({ id: "user-1" });
		getUser.mockResolvedValue({ id: "user-1", plan: "free", username: "alice" });
		verifyToken.mockResolvedValue(true);
		resolveUserEntitlements.mockResolvedValue({
			effectivePlan: "pro",
			isBillingPro: false,
			reverseTrialActive: true,
			trialEndsAt: null,
			hasActiveGrant: true,
			source: "reverse_trial",
		});

		const { validateAuth } = await loadAuth();
		await expect(validateAuth(false)).resolves.toEqual(
			expect.objectContaining({
				id: "user-1",
				entitlements: expect.objectContaining({
					effectivePlan: "pro",
				}),
			}),
		);
		expect(getUser).toHaveBeenCalledWith("user-1");
	});
});
