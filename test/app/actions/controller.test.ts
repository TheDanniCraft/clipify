import { Plan } from "@/app/lib/types";

const getOverlayWithEditAccess = jest.fn();
const getOverlayOwnerPlanPublic = jest.fn();
const getClipQueueByOverlayId = jest.fn();
const getModQueue = jest.fn();
const getTwitchCache = jest.fn();
const setPlayerVolumeForOwner = jest.fn();
const clearModQueueByBroadcasterId = jest.fn();
const clearClipQueueByOverlayIdServer = jest.fn();
const addToModQueue = jest.fn();
const getTwitchClip = jest.fn();
const handleClip = jest.fn();
const sendMessage = jest.fn();

jest.mock("@actions/database", () => ({
	getOverlayWithEditAccess: (...args: unknown[]) => getOverlayWithEditAccess(...args),
	getOverlayOwnerPlanPublic: (...args: unknown[]) => getOverlayOwnerPlanPublic(...args),
	getClipQueueByOverlayId: (...args: unknown[]) => getClipQueueByOverlayId(...args),
	getModQueue: (...args: unknown[]) => getModQueue(...args),
	getTwitchCache: (...args: unknown[]) => getTwitchCache(...args),
	setPlayerVolumeForOwner: (...args: unknown[]) => setPlayerVolumeForOwner(...args),
	clearModQueueByBroadcasterId: (...args: unknown[]) => clearModQueueByBroadcasterId(...args),
	clearClipQueueByOverlayIdServer: (...args: unknown[]) => clearClipQueueByOverlayIdServer(...args),
	addToModQueue: (...args: unknown[]) => addToModQueue(...args),
}));

jest.mock("@actions/twitch", () => ({
	getTwitchClip: (...args: unknown[]) => getTwitchClip(...args),
	handleClip: (...args: unknown[]) => handleClip(...args),
}));

jest.mock("@actions/websocket", () => ({
	sendMessage: (...args: unknown[]) => sendMessage(...args),
}));

describe("actions/controller", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		getOverlayWithEditAccess.mockResolvedValue({ id: "ov-1", ownerId: "owner-1" });
		getOverlayOwnerPlanPublic.mockResolvedValue(Plan.Pro);
		getClipQueueByOverlayId.mockResolvedValue([]);
		getModQueue.mockResolvedValue([]);
		getTwitchCache.mockResolvedValue(null);
		getTwitchClip.mockResolvedValue(null);
	});

	it("returns unauthorized when overlay edit access is missing", async () => {
		getOverlayWithEditAccess.mockResolvedValue(null);
		const { getControllerQueuesAction } = await import("@/app/actions/controller");

		await expect(getControllerQueuesAction("ov-1")).resolves.toEqual({
			ok: false,
			error: "Unauthorized",
			status: 403,
		});
	});

	it("returns pro-only error when owner plan is not pro", async () => {
		getOverlayOwnerPlanPublic.mockResolvedValue(Plan.Free);
		const { runControllerAction } = await import("@/app/actions/controller");

		await expect(runControllerAction("ov-1", { action: "clear_mod_queue" })).resolves.toEqual({
			ok: false,
			error: "Remote controller is a Pro feature",
			status: 403,
		});
	});

	it("returns mapped mod and viewer queues", async () => {
		getClipQueueByOverlayId.mockResolvedValue([{ id: "viewer-1", clipId: "clip-viewer" }]);
		getModQueue.mockResolvedValue([{ id: "mod-1", clipId: "clip-mod" }]);
		getTwitchCache
			.mockResolvedValueOnce({ clip: { id: "clip-viewer", title: "Viewer Clip", creator_name: "alice", duration: 11, thumbnail_url: "https://viewer" } })
			.mockResolvedValueOnce(null);
		getTwitchClip.mockResolvedValueOnce({ id: "clip-mod", title: "Mod Clip", creator_name: "bob", duration: 22, thumbnail_url: "https://mod" });
		const { getControllerQueuesAction } = await import("@/app/actions/controller");

		await expect(getControllerQueuesAction("ov-1")).resolves.toEqual({
			overlayId: "ov-1",
			viewerQueue: [
				{ id: "viewer-1", clipId: "clip-viewer", title: "Viewer Clip", creatorName: "alice", duration: 11, thumbnailUrl: "https://viewer" },
			],
			modQueue: [
				{ id: "mod-1", clipId: "clip-mod", title: "Mod Clip", creatorName: "bob", duration: 22, thumbnailUrl: "https://mod" },
			],
		});
	});

	it("sets volume and broadcasts the command", async () => {
		const { runControllerAction } = await import("@/app/actions/controller");

		await expect(runControllerAction("ov-1", { action: "set_volume", volume: 33.6 })).resolves.toEqual({
			ok: true,
			volume: 34,
		});
		expect(setPlayerVolumeForOwner).toHaveBeenCalledWith("owner-1", 34);
		expect(sendMessage).toHaveBeenCalledWith("command", { name: "volume", data: "34" }, "owner-1");
	});

	it("rejects invalid volume", async () => {
		const { runControllerAction } = await import("@/app/actions/controller");

		await expect(runControllerAction("ov-1", { action: "set_volume", volume: Number.NaN })).resolves.toEqual({
			ok: false,
			error: "Invalid volume",
			status: 400,
		});
	});

	it("clears mod, viewer, and all queues", async () => {
		const { runControllerAction } = await import("@/app/actions/controller");

		await expect(runControllerAction("ov-1", { action: "clear_mod_queue" })).resolves.toEqual({ ok: true });
		await expect(runControllerAction("ov-1", { action: "clear_viewer_queue" })).resolves.toEqual({ ok: true });
		await expect(runControllerAction("ov-1", { action: "clear_all_queues" })).resolves.toEqual({ ok: true });

		expect(clearModQueueByBroadcasterId).toHaveBeenNthCalledWith(1, "owner-1");
		expect(clearClipQueueByOverlayIdServer).toHaveBeenNthCalledWith(1, "ov-1");
		expect(clearModQueueByBroadcasterId).toHaveBeenNthCalledWith(2, "owner-1");
		expect(clearClipQueueByOverlayIdServer).toHaveBeenNthCalledWith(2, "ov-1");
	});

	it("maps clip URL validation and not-found errors", async () => {
		const { runControllerAction } = await import("@/app/actions/controller");

		handleClip.mockResolvedValueOnce({ errorCode: 1 });
		await expect(runControllerAction("ov-1", { action: "add_mod_clip", clipUrl: "bad" })).resolves.toEqual({
			ok: false,
			error: "Please provide a valid Twitch clip URL.",
			status: 400,
		});

		handleClip.mockResolvedValueOnce({ errorCode: 3 });
		await expect(runControllerAction("ov-1", { action: "add_mod_clip", clipUrl: "missing" })).resolves.toEqual({
			ok: false,
			error: "The requested clip could not be found.",
			status: 404,
		});
	});

	it("maps clip ownership and fallback errors", async () => {
		const { runControllerAction } = await import("@/app/actions/controller");

		handleClip.mockResolvedValueOnce({ errorCode: 4 });
		await expect(runControllerAction("ov-1", { action: "add_mod_clip", clipUrl: "wrong-owner" })).resolves.toEqual({
			ok: false,
			error: "You can only add clips from this channel.",
			status: 400,
		});

		handleClip.mockResolvedValueOnce({ errorCode: 99 });
		await expect(runControllerAction("ov-1", { action: "add_mod_clip", clipUrl: "unknown" })).resolves.toEqual({
			ok: false,
			error: "Unable to add this clip.",
			status: 400,
		});
	});

	it("adds a valid mod clip", async () => {
		handleClip.mockResolvedValue({
			id: "clip-1",
			title: "Clip One",
			creator_name: "alice",
			duration: 18,
			thumbnail_url: "https://clip",
		});
		const { runControllerAction } = await import("@/app/actions/controller");

		await expect(runControllerAction("ov-1", { action: "add_mod_clip", clipUrl: "https://clips.twitch.tv/abc" })).resolves.toEqual({
			ok: true,
			clip: {
				clipId: "clip-1",
				title: "Clip One",
				creatorName: "alice",
				duration: 18,
				thumbnailUrl: "https://clip",
			},
		});
		expect(addToModQueue).toHaveBeenCalledWith("owner-1", "clip-1");
	});

	it("rejects missing clip url and unknown actions", async () => {
		const { runControllerAction } = await import("@/app/actions/controller");

		await expect(runControllerAction("ov-1", { action: "add_mod_clip", clipUrl: "   " })).resolves.toEqual({
			ok: false,
			error: "Missing clip URL",
			status: 400,
		});
		await expect(runControllerAction("ov-1", { action: "nope" })).resolves.toEqual({
			ok: false,
			error: "Unknown action",
			status: 400,
		});
		await expect(runControllerAction("ov-1", null)).resolves.toEqual({
			ok: false,
			error: "Missing action",
			status: 400,
		});
	});
});
