/** @jest-environment node */
import { getOwnTwitchPresence } from "@actions/dashboardPresence";
const session = jest.fn(),
	own = jest.fn(),
	cached = jest.fn(),
	details = jest.fn(),
	write = jest.fn(),
	limit = jest.fn();
jest.mock("@/auth/session", () => ({ getAuthSession: () => session() }));
jest.mock("@/db/client", () => ({ db: { select: () => ({ from: () => ({ where: () => ({ limit: () => own() }) }) }) } }));
jest.mock("@actions/database", () => ({ getTwitchCache: (...args: unknown[]) => cached(...args), setTwitchCache: (...args: unknown[]) => write(...args) }));
jest.mock("@actions/twitch", () => ({ getCreatorTwitchDetails: (...args: unknown[]) => details(...args) }));
jest.mock("@actions/rateLimit", () => ({ tryRateLimit: () => limit() }));
beforeEach(() => {
	jest.clearAllMocks();
	session.mockResolvedValue({ user: { id: "signed-in" } });
	own.mockResolvedValue([{ creatorId: "own-channel" }]);
	cached.mockResolvedValue(null);
	limit.mockResolvedValue({ success: true });
});
it("never queries Twitch for an anonymous request", async () => {
	session.mockResolvedValue(null);
	expect(await getOwnTwitchPresence()).toBeNull();
	expect(own).not.toHaveBeenCalled();
});
it("uses the signed-in identity's cached presence", async () => {
	cached.mockResolvedValue({ live: true });
	expect(await getOwnTwitchPresence()).toBe(true);
	expect(cached).toHaveBeenCalledWith("user", "dashboard-live:own-channel");
	expect(details).not.toHaveBeenCalled();
});
it("reports red only after confirmed live data", async () => {
	details.mockResolvedValue({ live: { id: "stream" } });
	expect(await getOwnTwitchPresence()).toBe(true);
	expect(details).toHaveBeenCalledWith("", "own-channel");
	expect(write).toHaveBeenCalledWith("user", "dashboard-live:own-channel", { live: true }, 30);
});
it("fails quietly when unavailable or limited", async () => {
	limit.mockResolvedValue({ success: false });
	expect(await getOwnTwitchPresence()).toBeNull();
	expect(details).not.toHaveBeenCalled();
	limit.mockResolvedValue({ success: true });
	details.mockRejectedValue(new Error("offline"));
	expect(await getOwnTwitchPresence()).toBeNull();
});
