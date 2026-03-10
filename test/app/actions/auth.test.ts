/** @jest-environment node */
export {};

const verify = jest.fn();
const sign = jest.fn();
const cookies = jest.fn();
const getBaseUrl = jest.fn();
const dbSelect = jest.fn();
const dbInsert = jest.fn();
const dbUpdate = jest.fn();
const verifyToken = jest.fn();
const resolveUserEntitlements = jest.fn();

jest.mock("jsonwebtoken", () => ({
	__esModule: true,
	default: {
		verify: (...args: unknown[]) => verify(...args),
		sign: (...args: unknown[]) => sign(...args),
	},
}));

jest.mock("next/headers", () => ({
	cookies: (...args: unknown[]) => cookies(...args),
}));

jest.mock("@actions/utils", () => ({
	getBaseUrl: (...args: unknown[]) => getBaseUrl(...args),
}));

jest.mock("@/db/client", () => ({
	db: {
		select: (...args: unknown[]) => dbSelect(...args),
		insert: (...args: unknown[]) => dbInsert(...args),
		update: (...args: unknown[]) => dbUpdate(...args),
	},
}));

jest.mock("@/db/schema", () => ({
	usersTable: {
		id: "id",
	},
	adminImpersonationSessionsTable: {
		id: "id",
		adminUserId: "admin_user_id",
		targetUserId: "target_user_id",
		startedAt: "started_at",
		endedAt: "ended_at",
		updatedAt: "updated_at",
	},
}));

jest.mock("drizzle-orm", () => ({
	and: (...args: unknown[]) => ({ op: "and", args }),
	eq: (...args: unknown[]) => ({ op: "eq", args }),
	isNull: (...args: unknown[]) => ({ op: "isNull", args }),
	lt: (...args: unknown[]) => ({ op: "lt", args }),
}));

jest.mock("@actions/twitch", () => ({
	verifyToken: (...args: unknown[]) => verifyToken(...args),
}));

jest.mock("@lib/entitlements", () => ({
	resolveUserEntitlements: (...args: unknown[]) => resolveUserEntitlements(...args),
}));

let cookieValues: Record<string, string> = {};
let cookieSet: jest.Mock;

function mockDbRows(...rows: unknown[][]) {
	const execute = jest.fn();
	for (const row of rows) {
		execute.mockResolvedValueOnce(row);
	}
	dbSelect.mockReturnValue({
		from: () => ({
			where: () => ({
				limit: () => ({
					execute,
				}),
			}),
		}),
	});
	return execute;
}

async function loadAuth() {
	jest.resetModules();
	return import("@/app/actions/auth");
}

describe("actions/auth", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		process.env.JWT_SECRET = "jwt-secret";
		cookieValues = {};
		cookieSet = jest.fn();
		cookies.mockResolvedValue({
			get: (name: string) => {
				const value = cookieValues[name];
				return value ? { value } : undefined;
			},
			set: cookieSet,
			delete: jest.fn(),
		});
		dbInsert.mockReturnValue({
			values: () => ({
				returning: () => ({
					execute: jest.fn().mockResolvedValue([{ id: "session-1" }]),
				}),
			}),
		});
		dbUpdate.mockReturnValue({
			set: () => ({
				where: () => ({
					execute: jest.fn().mockResolvedValue(undefined),
				}),
			}),
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

	it("resolves admin-view target user when skipUserCheck is enabled", async () => {
		cookieValues.token = "jwt-token";
		cookieValues.admin_view = "admin-view-token";
		verify.mockImplementation((token: string) => {
			if (token === "jwt-token") return { id: "admin-1" };
			if (token === "admin-view-token") return { adminUserId: "admin-1", targetUserId: "user-2" };
			throw new Error("invalid token");
		});
		mockDbRows([{ id: "admin-1", username: "root", role: "admin", plan: "pro" }], [{ id: "user-2", username: "alice", role: "user", plan: "free" }]);

		const { validateAuth } = await loadAuth();
		await expect(validateAuth(true)).resolves.toEqual(
			expect.objectContaining({
				id: "user-2",
				username: "alice",
				adminView: expect.objectContaining({
					active: true,
					adminUserId: "admin-1",
				}),
			}),
		);
	});

	it("returns enriched user for non-admin sessions", async () => {
		cookieValues.token = "jwt-token";
		verify.mockReturnValue({ id: "user-1" });
		mockDbRows([{ id: "user-1", username: "alice", role: "user", plan: "free" }]);
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
		expect(verifyToken).not.toHaveBeenCalled();
	});

	it("returns false when actor user lookup fails", async () => {
		cookieValues.token = "jwt-token";
		verify.mockReturnValue({ id: "missing-user" });
		mockDbRows([]);

		const { validateAuth } = await loadAuth();
		await expect(validateAuth(false)).resolves.toBe(false);
	});

	it("returns enriched user even when external token verification would fail", async () => {
		cookieValues.token = "jwt-token";
		verify.mockReturnValue({ id: "user-1" });
		mockDbRows([{ id: "user-1", username: "alice", role: "user", plan: "free" }]);
		verifyToken.mockResolvedValue(false);
		resolveUserEntitlements.mockResolvedValue({ effectivePlan: "pro" });

		const { validateAuth } = await loadAuth();
		await expect(validateAuth(false)).resolves.toEqual(
			expect.objectContaining({
				id: "user-1",
				entitlements: expect.objectContaining({ effectivePlan: "pro" }),
			}),
		);
	});

	it("returns impersonated user when admin-view target exists", async () => {
		cookieValues.token = "jwt-token";
		cookieValues.admin_view = "admin-view-token";
		verify.mockImplementation((token: string) => {
			if (token === "jwt-token") return { id: "admin-1" };
			if (token === "admin-view-token") return { adminUserId: "admin-1", targetUserId: "user-2" };
			throw new Error("invalid token");
		});
		mockDbRows([{ id: "admin-1", username: "root", role: "admin", plan: "pro" }], [{ id: "user-2", username: "alice", role: "user", plan: "free" }]);
		resolveUserEntitlements.mockResolvedValue({ effectivePlan: "pro" });

		const { validateAuth } = await loadAuth();
		await expect(validateAuth(false)).resolves.toEqual(
			expect.objectContaining({
				id: "user-2",
				entitlements: expect.objectContaining({ effectivePlan: "pro" }),
			}),
		);
	});

	it("rejects non-admin users in validateAdminAuth", async () => {
		cookieValues.token = "jwt-token";
		verify.mockReturnValue({ id: "user-1" });
		mockDbRows([{ id: "user-1", username: "alice", role: "user", plan: "free" }]);

		const { validateAdminAuth } = await loadAuth();
		await expect(validateAdminAuth(false)).resolves.toBe(false);
		expect(cookieSet).not.toHaveBeenCalled();
	});

	it("returns enriched admin user in validateAdminAuth when verification succeeds", async () => {
		cookieValues.token = "jwt-token";
		verify.mockReturnValue({ id: "admin-1" });
		mockDbRows([{ id: "admin-1", username: "root", role: "admin", plan: "pro" }]);
		verifyToken.mockResolvedValue(true);
		resolveUserEntitlements.mockResolvedValue({ effectivePlan: "pro" });

		const { validateAdminAuth } = await loadAuth();
		await expect(validateAdminAuth(false)).resolves.toEqual(
			expect.objectContaining({
				id: "admin-1",
				entitlements: expect.objectContaining({
					effectivePlan: "pro",
				}),
			}),
		);
	});

	it("returns unauthorized when non-admin tries startAdminView", async () => {
		cookieValues.token = "jwt-token";
		verify.mockReturnValue({ id: "user-1" });
		mockDbRows([{ id: "user-1", username: "alice", role: "user", plan: "free" }]);

		const { startAdminView } = await loadAuth();
		await expect(startAdminView("user-2")).resolves.toEqual({ ok: false, error: "unauthorized" });
	});

	it("returns invalid_target when startAdminView receives empty target id", async () => {
		cookieValues.token = "jwt-token";
		verify.mockReturnValue({ id: "admin-1" });
		mockDbRows([{ id: "admin-1", username: "root", role: "admin", plan: "pro" }]);

		const { startAdminView } = await loadAuth();
		await expect(startAdminView("   ")).resolves.toEqual({ ok: false, error: "invalid_target" });
	});

	it("returns not_found when startAdminView target does not exist", async () => {
		cookieValues.token = "jwt-token";
		verify.mockReturnValue({ id: "admin-1" });
		mockDbRows([{ id: "admin-1", username: "root", role: "admin", plan: "pro" }], []);

		const { startAdminView } = await loadAuth();
		await expect(startAdminView("user-2")).resolves.toEqual({ ok: false, error: "not_found" });
	});

	it("clears impersonation cookie when admin targets themselves", async () => {
		cookieValues.token = "jwt-token";
		verify.mockReturnValue({ id: "admin-1" });
		mockDbRows([{ id: "admin-1", username: "root", role: "admin", plan: "pro" }]);

		const { startAdminView } = await loadAuth();
		await expect(startAdminView("admin-1")).resolves.toEqual({ ok: true });
		expect(cookieSet).toHaveBeenCalledWith(
			"admin_view",
			"",
			expect.objectContaining({
				maxAge: 0,
			}),
		);
	});

	it("keeps impersonation flow working if session insert fails", async () => {
		const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
		cookieValues.token = "jwt-token";
		verify.mockReturnValue({ id: "admin-1" });
		sign.mockReturnValue("signed-admin-view");
		dbInsert.mockReturnValue({
			values: () => ({
				returning: () => ({
					execute: jest.fn().mockRejectedValue(new Error("db down")),
				}),
			}),
		});
		mockDbRows([{ id: "admin-1", username: "root", role: "admin", plan: "pro" }], [{ id: "user-2", username: "alice", role: "user", plan: "free" }]);

		const { startAdminView } = await loadAuth();
		await expect(startAdminView("user-2")).resolves.toEqual({ ok: true });
		expect(cookieSet).toHaveBeenCalledWith(
			"admin_view",
			"signed-admin-view",
			expect.objectContaining({
				maxAge: 60 * 60,
			}),
		);
		consoleSpy.mockRestore();
	});

	it("returns active false for admin-view status when user not authenticated", async () => {
		const { getAdminViewStatus } = await loadAuth();
		await expect(getAdminViewStatus()).resolves.toEqual({ active: false });
	});

	it("clears malformed admin_view_session cookie without writing update", async () => {
		cookieValues.admin_view_session = "not-a-uuid";
		const { clearAdminView } = await loadAuth();
		await clearAdminView();
		expect(dbUpdate).not.toHaveBeenCalled();
		expect(cookieSet).toHaveBeenCalledWith(
			"admin_view_session",
			"",
			expect.objectContaining({
				maxAge: 0,
			}),
		);
	});

	it("closes admin-view session in validateAuth for non-admin users without mutating cookies", async () => {
		cookieValues.token = "jwt-token";
		cookieValues.admin_view_session = "123e4567-e89b-12d3-a456-426614174000";
		verify.mockReturnValue({ id: "user-1" });
		mockDbRows([{ id: "user-1", username: "alice", role: "user", plan: "free" }]);
		resolveUserEntitlements.mockResolvedValue({ effectivePlan: "free" });

		const { validateAuth } = await loadAuth();
		await expect(validateAuth(false)).resolves.toEqual(expect.objectContaining({ id: "user-1" }));
		expect(dbUpdate).toHaveBeenCalled();
		expect(cookieSet).not.toHaveBeenCalledWith("admin_view_session", "", expect.anything());
	});

	it("closes admin-view session when admin_view payload is invalid without mutating cookies", async () => {
		cookieValues.token = "jwt-token";
		cookieValues.admin_view = "admin-view-token";
		cookieValues.admin_view_session = "123e4567-e89b-12d3-a456-426614174000";
		verify.mockImplementation((token: string) => {
			if (token === "jwt-token") return { id: "admin-1" };
			if (token === "admin-view-token") return { adminUserId: "different-admin", targetUserId: "user-2" };
			throw new Error("invalid token");
		});
		mockDbRows([{ id: "admin-1", username: "root", role: "admin", plan: "pro" }]);
		resolveUserEntitlements.mockResolvedValue({ effectivePlan: "pro" });

		const { validateAuth } = await loadAuth();
		await expect(validateAuth(false)).resolves.toEqual(expect.objectContaining({ id: "admin-1" }));
		expect(dbUpdate).toHaveBeenCalled();
		expect(cookieSet).not.toHaveBeenCalledWith("admin_view_session", "", expect.anything());
	});

	it("closes admin-view session when payload targets the actor user", async () => {
		cookieValues.token = "jwt-token";
		cookieValues.admin_view = "admin-view-token";
		cookieValues.admin_view_session = "123e4567-e89b-12d3-a456-426614174000";
		verify.mockImplementation((token: string) => {
			if (token === "jwt-token") return { id: "admin-1" };
			if (token === "admin-view-token") return { adminUserId: "admin-1", targetUserId: "admin-1" };
			throw new Error("invalid token");
		});
		mockDbRows([{ id: "admin-1", username: "root", role: "admin", plan: "pro" }]);
		resolveUserEntitlements.mockResolvedValue({ effectivePlan: "pro" });

		const { validateAuth } = await loadAuth();
		await expect(validateAuth(false)).resolves.toEqual(expect.objectContaining({ id: "admin-1" }));
		expect(dbUpdate).toHaveBeenCalled();
	});

	it("closes admin-view session when impersonation target user is missing", async () => {
		cookieValues.token = "jwt-token";
		cookieValues.admin_view = "admin-view-token";
		cookieValues.admin_view_session = "123e4567-e89b-12d3-a456-426614174000";
		verify.mockImplementation((token: string) => {
			if (token === "jwt-token") return { id: "admin-1" };
			if (token === "admin-view-token") return { adminUserId: "admin-1", targetUserId: "user-2" };
			throw new Error("invalid token");
		});
		mockDbRows([{ id: "admin-1", username: "root", role: "admin", plan: "pro" }], []);
		resolveUserEntitlements.mockResolvedValue({ effectivePlan: "pro" });

		const { validateAuth } = await loadAuth();
		await expect(validateAuth(false)).resolves.toEqual(expect.objectContaining({ id: "admin-1" }));
		expect(dbUpdate).toHaveBeenCalled();
	});

	it("sets admin-view cookie for valid admin impersonation requests", async () => {
		cookieValues.token = "jwt-token";
		verify.mockReturnValue({ id: "admin-1" });
		sign.mockReturnValue("signed-admin-view");
		mockDbRows([{ id: "admin-1", username: "root", role: "admin", plan: "pro" }], [{ id: "user-2", username: "alice", role: "user", plan: "free" }]);

		const { startAdminView } = await loadAuth();
		await expect(startAdminView("user-2")).resolves.toEqual({ ok: true });
		expect(sign).toHaveBeenCalledWith(
			expect.objectContaining({
				adminUserId: "admin-1",
				targetUserId: "user-2",
			}),
			"jwt-secret",
			expect.objectContaining({
				expiresIn: 60 * 60,
			}),
		);
		expect(cookieSet).toHaveBeenCalledWith(
			"admin_view",
			"signed-admin-view",
			expect.objectContaining({
				httpOnly: true,
				maxAge: 60 * 60,
				path: "/",
			}),
		);
		expect(cookieSet).toHaveBeenCalledWith(
			"admin_view_session",
			"session-1",
			expect.objectContaining({
				maxAge: 60 * 60,
			}),
		);
	});

	it("clears admin-view cookie on demand", async () => {
		cookieValues.admin_view_session = "session-1";
		const { clearAdminView } = await loadAuth();
		await clearAdminView();
		expect(cookieSet).toHaveBeenCalledWith(
			"admin_view",
			"",
			expect.objectContaining({
				maxAge: 0,
			}),
		);
		expect(cookieSet).toHaveBeenCalledWith(
			"admin_view_session",
			"",
			expect.objectContaining({
				maxAge: 0,
			}),
		);
	});
});
