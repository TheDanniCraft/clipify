const authenticate = jest.fn();
const save = jest.fn();
jest.mock("@actions/auth", () => ({ validateAuth: (...args: unknown[]) => authenticate(...args) }));
jest.mock("@/server/user-tour/progress", () => ({ applyUserTourEvent: (...args: unknown[]) => save(...args) }));
import { saveUserTourEvent } from "@actions/userTour";
beforeEach(() => {
	jest.clearAllMocks();
	authenticate.mockResolvedValue({ id: "owner" });
	save.mockResolvedValue(undefined);
});
it("requires the current authenticated account and rejects stale-account requests", async () => {
	authenticate.mockResolvedValue(null);
	expect(await saveUserTourEvent("owner", { type: "panel", minimized: true })).toMatchObject({ ok: false });
	authenticate.mockResolvedValue({ id: "other" });
	expect(await saveUserTourEvent("owner", { type: "task.skip", task: "overlay.name" })).toMatchObject({ ok: false });
	expect(save).not.toHaveBeenCalled();
});
it("validates persisted events and never accepts another owner's resource event", async () => {
	expect(await saveUserTourEvent("owner", { type: "task.skip", task: "unrecognized" })).toMatchObject({ ok: false });
	expect(await saveUserTourEvent("owner", { type: "overlay.ready", ownerId: "other", id: "foreign" })).toMatchObject({ ok: false });
	expect(save).not.toHaveBeenCalled();
});
it("saves a valid event in the authenticated account scope", async () => {
	const event = { type: "task.skip", task: "overlay.preview" } as const;
	expect(await saveUserTourEvent("owner", event)).toEqual({ ok: true, accountId: "owner" });
	expect(save).toHaveBeenCalledWith("owner", event);
});
