/** @jest-environment node */

const getSession = jest.fn<Promise<unknown>, [unknown?]>();
const nextHeaders = jest.fn();
const selectResults: unknown[][] = [];

function selectChain() {
	const chain = {
		from: jest.fn(),
		where: jest.fn(),
		limit: jest.fn(),
		execute: jest.fn(),
	};
	chain.from.mockReturnValue(chain);
	chain.where.mockReturnValue(chain);
	chain.limit.mockReturnValue(chain);
	chain.execute.mockImplementation(async () => selectResults.shift() ?? []);
	return chain;
}

const select = jest.fn((..._args: unknown[]) => selectChain());

jest.mock("next/headers", () => ({ headers: () => nextHeaders() }));
jest.mock("@/auth/config", () => ({ auth: { api: { getSession: (...args: unknown[]) => getSession(...args) } } }));
jest.mock("@/db/client", () => ({ db: { select: (...args: unknown[]) => select(...args) } }));
jest.mock("@/db/schema", () => ({
	creatorAccountsTable: { creatorId: "creator_accounts.creator_id", organizationId: "creator_accounts.organization_id", status: "creator_accounts.status" },
	creatorIdentityLinksTable: { creatorId: "creator_identity_links.creator_id", authUserId: "creator_identity_links.auth_user_id" },
	usersTable: { id: "users.id" },
}));
jest.mock("drizzle-orm", () => ({ eq: jest.fn(() => "eq") }));

import { getAuthActorContext, getAuthSession, requireAuthSession } from "@/auth/session";

const future = () => new Date("2100-01-01T00:00:00.000Z");
const past = () => new Date("2000-01-01T00:00:00.000Z");

function session(overrides: Record<string, unknown> = {}) {
	return {
		session: {
			id: "session-1",
			userId: "auth-user-1",
			expiresAt: future(),
			createdAt: new Date("2026-09-29T00:00:00.000Z"),
			activeOrganizationId: null,
			...overrides,
		},
	};
}

describe("TDD-US3-005 Better Auth session database boundary", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		selectResults.length = 0;
		nextHeaders.mockResolvedValue(new Headers({ "x-source": "next" }));
		getSession.mockResolvedValue(session());
	});

	it("uses explicit headers or the Next request headers", async () => {
		const explicit = new Headers({ "x-source": "explicit" });
		await expect(getAuthSession(explicit)).resolves.toEqual(session());
		expect(getSession).toHaveBeenLastCalledWith({ headers: explicit });

		await getAuthSession();
		expect(nextHeaders).toHaveBeenCalledTimes(1);
		expect(getSession).toHaveBeenLastCalledWith({ headers: expect.any(Headers) });
	});

	it("requires an authenticated Better Auth session", async () => {
		getSession.mockResolvedValueOnce(null);
		await expect(requireAuthSession()).rejects.toThrow("AUTHENTICATION_REQUIRED");
		await expect(requireAuthSession()).resolves.toEqual(session());
	});

	it("returns null for absent and expired sessions before reading domain state", async () => {
		getSession.mockResolvedValueOnce(null).mockResolvedValueOnce(session({ expiresAt: past().toISOString() }));
		await expect(getAuthActorContext()).resolves.toBeNull();
		await expect(getAuthActorContext()).resolves.toBeNull();
		expect(select).not.toHaveBeenCalled();
	});

	it("resolves the active creator organization and normalizes serialized dates", async () => {
		getSession.mockResolvedValueOnce(session({ activeOrganizationId: "creator-org-1", createdAt: "2026-09-29T00:00:00.000Z", expiresAt: future().toISOString() }));
		selectResults.push([{ creatorId: "creator-1", status: "active" }], [{ id: "creator-1", disabled: false, email: "creator@example.test" }]);

		await expect(getAuthActorContext()).resolves.toMatchObject({
			authUserId: "auth-user-1",
			sessionId: "session-1",
			creatorId: "creator-1",
			activeOrganizationId: "creator-org-1",
			accountStatus: "active",
			authenticatedAt: new Date("2026-09-29T00:00:00.000Z"),
		});
	});

	it("falls back through the identity link and creator account", async () => {
		selectResults.push([{ creatorId: "creator-2" }], [{ status: "suspension_scheduled" }], [{ id: "creator-2", disabled: false }]);
		await expect(getAuthActorContext()).resolves.toMatchObject({ creatorId: "creator-2", activeOrganizationId: null, accountStatus: "suspension_scheduled" });
	});

	it.each([
		{ results: [[], []], label: "missing identity link" },
		{ results: [[{ creatorId: "creator-3" }], []], label: "missing creator account" },
		{ results: [[{ creatorId: "creator-3" }], [{ status: "active" }], []], label: "missing creator profile" },
		{ results: [[{ creatorId: "creator-3" }], [{ status: "active" }], [{ id: "creator-3", disabled: true }]], label: "disabled creator profile" },
	])("denies $label", async ({ results }) => {
		selectResults.push(...results);
		await expect(getAuthActorContext()).resolves.toBeNull();
	});
});
