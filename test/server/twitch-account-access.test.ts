/** @jest-environment node */
jest.mock("server-only", () => ({}));
const read = jest.fn(),
	update = jest.fn(),
	queue = jest.fn();
const tx = {
	select: () => ({ from: () => ({ where: () => ({ for: read }) }) }),
	update: () => ({
		set: (value: unknown) => {
			update(value);
			return { where: async () => {} };
		},
	}),
};
const transaction = jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx));
jest.mock("@/db/client", () => ({ db: { select: () => ({ from: () => ({ where: async () => [{ creatorId: "alex" }] }) }), transaction: (callback: (value: typeof tx) => unknown) => transaction(callback) } }));
jest.mock("@/server/notifications/account-access-events", () => ({ queueAccountAccessEmail: (...args: unknown[]) => queue(...args) }));
import { observeTwitchRefresh, markInvalidTwitchRefresh, restoreTwitchAccountAccess } from "@/server/notifications/twitch-account-access";
beforeEach(() => {
	jest.clearAllMocks();
	read.mockResolvedValue([{ id: "alex", username: "Alex", email: "alex@example.test", disabled: false }]);
});
test("confirmed invalid refresh disables and pauses exactly the resolved creator", async () => {
	await expect(
		observeTwitchRefresh("alex", async () => {
			markInvalidTwitchRefresh();
			throw new Error("Provider failure");
		}),
	).rejects.toThrow("Provider failure");
	expect(update).toHaveBeenCalledWith(expect.objectContaining({ disabled: true, disableType: "automatic" }));
	expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: "paused" }));
	expect(queue).toHaveBeenCalledWith(expect.objectContaining({ userId: "alex", automatic: true, disabled: true }), tx);
});
test("a generic provider failure neither disables nor queues mail", async () => {
	await expect(
		observeTwitchRefresh("alex", async () => {
			throw new Error("Unavailable");
		}),
	).rejects.toThrow("Unavailable");
	expect(transaction).not.toHaveBeenCalled();
	expect(queue).not.toHaveBeenCalled();
});
test("concurrent outcomes are isolated and manual disablements remain untouched", async () => {
	read.mockResolvedValue([{ id: "alex", disabled: true, disableType: "manual" }]);
	await Promise.allSettled([
		observeTwitchRefresh("alex", async () => {
			markInvalidTwitchRefresh();
			throw new Error("Invalid");
		}),
		observeTwitchRefresh("other", async () => {
			throw new Error("Unavailable");
		}),
	]);
	expect(transaction).toHaveBeenCalledTimes(1);
	expect(update).not.toHaveBeenCalled();
	expect(queue).not.toHaveBeenCalled();
});

test("reconnection restores automatic disablement without resuming overlays", async () => {
	read.mockResolvedValue([{ id: "alex", username: "Alex", email: "alex@example.test", disabled: true, disableType: "automatic" }]);
	await restoreTwitchAccountAccess("identity");
	expect(update).toHaveBeenCalledTimes(1);
	expect(update).toHaveBeenCalledWith(expect.objectContaining({ disabled: false, disableType: null }));
	expect(queue).toHaveBeenCalledWith(expect.objectContaining({ disabled: false }), tx);
});
test("reconnection preserves an administrative disablement", async () => {
	read.mockResolvedValue([{ id: "alex", disabled: true, disableType: "manual" }]);
	await restoreTwitchAccountAccess("identity");
	expect(update).not.toHaveBeenCalled();
	expect(queue).not.toHaveBeenCalled();
});
