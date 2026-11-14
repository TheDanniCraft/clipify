/** @jest-environment node */
const actor = jest.fn();
const limit = jest.fn();
const select = jest.fn(() => ({ from: () => ({ where: () => ({ limit }) }) }));
jest.mock("@/auth/session", () => ({ getAuthActorContext: () => actor() }));
jest.mock("@/db/client", () => ({ db: { select: () => select() } }));
import { getDefaultAccountContext } from "@/app/actions/accountContext";

beforeEach(() => {
	jest.clearAllMocks();
	actor.mockResolvedValue({ creatorId: "own", activeOrganizationId: null, accountStatus: "active" });
	limit.mockResolvedValue([{ organizationId: "own-organization" }]);
});
it("reads the authenticated creator's implicit context without accepting a target ID", async () => {
	await expect(getDefaultAccountContext()).resolves.toBe("own-organization");
	expect(select).toHaveBeenCalledTimes(1);
});
it.each([null, { activeOrganizationId: "explicit-workspace", accountStatus: "active" }, { activeOrganizationId: null, accountStatus: "suspended" }, { activeOrganizationId: null, accountStatus: "purge_eligible" }])("does not replace an explicit or unavailable context: %p", async (context) => {
	actor.mockResolvedValue(context);
	await expect(getDefaultAccountContext()).resolves.toBeNull();
	expect(select).not.toHaveBeenCalled();
});
it("keeps a missing personal context unselected", async () => {
	limit.mockResolvedValue([]);
	await expect(getDefaultAccountContext()).resolves.toBeNull();
});
