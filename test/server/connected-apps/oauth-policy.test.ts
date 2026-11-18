/** @jest-environment node */
jest.mock("server-only", () => ({}));
jest.mock("@/auth/session", () => ({ getAuthActorContext: jest.fn() }));
jest.mock("@/db/client", () => ({ db: { select: jest.fn() } }));
import { getAuthActorContext } from "@/auth/session";
import { db } from "@/db/client";
import { requireConnectedAppAdmin } from "@/server/connected-apps/oauth-policy";

beforeEach(() => jest.clearAllMocks());
test("rejects provisioning without a verified admin session", async () => {
	jest.mocked(getAuthActorContext).mockResolvedValue(null);
	await expect(requireConnectedAppAdmin(new Headers())).rejects.toThrow("ACCESS_DENIED");
	expect(db.select).not.toHaveBeenCalled();
});

const admin = { authUserId: "admin-auth", sessionId: "admin-session", authenticatedAt: new Date(), creatorId: "admin-creator", activeOrganizationId: null, accountStatus: "active", user: { id: "admin-creator", role: "admin", disabled: false } };
function actor(value = admin, linked = "admin-creator") {
	jest.mocked(getAuthActorContext).mockResolvedValue(value as never);
	const query = { from: () => query, where: () => query, limit: async () => [{ creatorId: linked }] };
	jest.mocked(db.select).mockReturnValue(query as never);
}
test("allows the admin's own verified identity and returns the real audit actor", async () => {
	actor();
	const headers = new Headers({ cookie: "session=verified" });
	await expect(requireConnectedAppAdmin(headers)).resolves.toBe(admin);
	expect(getAuthActorContext).toHaveBeenCalledWith(headers);
});
test("requires recent authentication only for credential mutations", async () => {
	actor({ ...admin, authenticatedAt: new Date(Date.now() - 5 * 60 * 1000 - 1) });
	await expect(requireConnectedAppAdmin(new Headers())).resolves.toMatchObject({ authUserId: "admin-auth" });
	await expect(requireConnectedAppAdmin(new Headers(), true)).rejects.toThrow("RECENT_AUTH_REQUIRED");
});

test.each([
	["ordinary creator", { ...admin, user: { ...admin.user, role: "user" } }],
	["disabled admin", { ...admin, user: { ...admin.user, disabled: true } }],
	["suspended admin", { ...admin, accountStatus: "suspended" }],
	["purge-eligible admin", { ...admin, accountStatus: "purge_eligible" }],
])("rejects %s without consulting creator links", async (_label, value) => {
	actor(value as typeof admin);
	await expect(requireConnectedAppAdmin(new Headers())).rejects.toThrow("ACCESS_DENIED");
	expect(db.select).not.toHaveBeenCalled();
});
test("a selected creator's admin role cannot confer provisioning privileges", async () => {
	actor(admin, "different-own-creator");
	await expect(requireConnectedAppAdmin(new Headers())).rejects.toThrow("ACCESS_DENIED");
});
test("an absent own identity link cannot confer provisioning privileges", async () => {
	actor();
	const query = { from: () => query, where: () => query, limit: async () => [] };
	jest.mocked(db.select).mockReturnValue(query as never);
	await expect(requireConnectedAppAdmin(new Headers())).rejects.toThrow("ACCESS_DENIED");
});
