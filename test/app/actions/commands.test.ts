/** @jest-environment node */
export {};

const sendMessage = jest.fn();
const getTwitchClip = jest.fn();
const handleClip = jest.fn();
const sendChatMessage = jest.fn();
const addToModQueue = jest.fn();
const clearClipQueueByOverlayIdServer = jest.fn();
const clearModQueueByBroadcasterId = jest.fn();
const getAllOverlayIdsByOwnerServer = jest.fn();
const getAllOverlaysByOwnerServer = jest.fn();
const getClipQueueByOverlayId = jest.fn();
const getModQueue = jest.fn();
const getSettings = jest.fn();
const getUserByIdServer = jest.fn();
const setPlayerVolumeForOwner = jest.fn();
const getFeatureAccess = jest.fn();
const getBaseUrl = jest.fn();

jest.mock("@actions/websocket", () => ({
	sendMessage: (...args: unknown[]) => sendMessage(...args),
}));

jest.mock("@actions/twitch", () => ({
	getTwitchClip: (...args: unknown[]) => getTwitchClip(...args),
	handleClip: (...args: unknown[]) => handleClip(...args),
	sendChatMessage: (...args: unknown[]) => sendChatMessage(...args),
}));

jest.mock("@actions/database", () => ({
	addToModQueue: (...args: unknown[]) => addToModQueue(...args),
	clearClipQueueByOverlayIdServer: (...args: unknown[]) => clearClipQueueByOverlayIdServer(...args),
	clearModQueueByBroadcasterId: (...args: unknown[]) => clearModQueueByBroadcasterId(...args),
	getAllOverlayIdsByOwnerServer: (...args: unknown[]) => getAllOverlayIdsByOwnerServer(...args),
	getAllOverlaysByOwnerServer: (...args: unknown[]) => getAllOverlaysByOwnerServer(...args),
	getClipQueueByOverlayId: (...args: unknown[]) => getClipQueueByOverlayId(...args),
	getModQueue: (...args: unknown[]) => getModQueue(...args),
	getSettings: (...args: unknown[]) => getSettings(...args),
	getUserByIdServer: (...args: unknown[]) => getUserByIdServer(...args),
	setPlayerVolumeForOwner: (...args: unknown[]) => setPlayerVolumeForOwner(...args),
}));

jest.mock("@lib/featureAccess", () => ({
	getFeatureAccess: (...args: unknown[]) => getFeatureAccess(...args),
}));

jest.mock("@actions/utils", () => ({
	getBaseUrl: (...args: unknown[]) => getBaseUrl(...args),
}));

function buildMessage(text: string, extras?: Partial<Record<string, unknown>>) {
	return {
		broadcaster_user_id: "owner-1",
		broadcaster_user_name: "Owner",
		broadcaster_user_login: "owner",
		chatter_user_id: "viewer-1",
		chatter_user_name: "Viewer",
		chatter_user_login: "viewer",
		message_id: "msg-1",
		message: {
			text,
			fragments: [{ type: "text", text }],
		},
		badges: [],
		...extras,
	} as never;
}

async function loadCommands() {
	jest.resetModules();
	return import("@/app/actions/commands");
}

describe("actions/commands", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		getSettings.mockResolvedValue({ prefix: "!" });
		getUserByIdServer.mockResolvedValue({
			id: "owner-1",
			plan: "free",
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			entitlements: {
				effectivePlan: "pro",
				source: "billing",
				isBillingPro: true,
				reverseTrialActive: false,
				trialEndsAt: null,
				hasActiveGrant: false,
			},
		});
		getFeatureAccess.mockReturnValue({ allowed: true });
		getBaseUrl.mockResolvedValue(new URL("https://clipify.us"));
	});

	it("detects command prefix from settings", async () => {
		const { isCommand } = await loadCommands();
		await expect(isCommand(buildMessage("!help"))).resolves.toBe(true);
		await expect(isCommand(buildMessage("hello"))).resolves.toBe(false);
	});

	it("detects mod privileges from broadcaster or moderator badge", async () => {
		const { isMod } = await loadCommands();
		await expect(isMod(buildMessage("x", { chatter_user_id: "owner-1" }))).resolves.toBe(true);
		await expect(isMod(buildMessage("x", { badges: [{ set_id: "moderator", id: "1", info: "" }] }))).resolves.toBe(true);
		await expect(isMod(buildMessage("x"))).resolves.toBe(false);
	});

	it("responds with unknown command message", async () => {
		const { handleCommand } = await loadCommands();
		await handleCommand(buildMessage("!doesnotexist"));
		expect(sendChatMessage).toHaveBeenCalledWith(
			"owner-1",
			expect.stringContaining('unknown command. Use "!help"'),
		);
	});

	it("gates chat commands when feature access is denied", async () => {
		getFeatureAccess.mockReturnValue({ allowed: false });
		const { handleCommand } = await loadCommands();
		await handleCommand(buildMessage("!play"));
		expect(sendChatMessage).toHaveBeenCalledWith(
			"owner-1",
			expect.stringContaining("chat commands are a Pro feature"),
		);
	});

	it("executes !play without args and resumes playback", async () => {
		const { handleCommand } = await loadCommands();
		await handleCommand(buildMessage("!play"));
		expect(sendMessage).toHaveBeenCalledWith("command", { name: "play", data: null }, "owner-1");
		expect(sendChatMessage).toHaveBeenCalledWith("owner-1", expect.stringContaining("playback has been resumed"));
	});

	it("handles invalid clip input for !play", async () => {
		handleClip.mockResolvedValue({ errorCode: 1 });
		const { handleCommand } = await loadCommands();
		await handleCommand(buildMessage("!play invalid-url"));
		expect(sendChatMessage).toHaveBeenCalledWith(
			"owner-1",
			expect.stringContaining("please provide a valid Twitch clip URL"),
		);
	});

	it("does not handle commands for non-text message fragments", async () => {
		const { handleCommand } = await loadCommands();
		await handleCommand(
			buildMessage("!play", {
				message: { text: "!play", fragments: [{ type: "mention", text: "!play" }] },
			}),
		);
		expect(sendMessage).not.toHaveBeenCalled();
		expect(sendChatMessage).not.toHaveBeenCalled();
	});

	it("sends one upgrade message per user during cooldown when commands are gated", async () => {
		getFeatureAccess.mockReturnValue({ allowed: false });
		const { handleCommand } = await loadCommands();
		await handleCommand(buildMessage("!play"));
		await handleCommand(buildMessage("!play"));
		expect(sendChatMessage).toHaveBeenCalledTimes(1);
	});

	it("queues a valid clip for !play and notifies chat", async () => {
		handleClip.mockResolvedValue({ id: "clip-77", title: "Huge clutch" });
		const { handleCommand } = await loadCommands();
		await handleCommand(buildMessage("!play https://clips.twitch.tv/Clip77"));
		expect(sendMessage).toHaveBeenCalledWith(
			"command",
			{ name: "play", data: { clip: expect.objectContaining({ id: "clip-77" }) } },
			"owner-1",
		);
		expect(addToModQueue).toHaveBeenCalledWith("owner-1", "clip-77");
		expect(sendChatMessage).toHaveBeenCalledWith("owner-1", expect.stringContaining("has been added to the queue"));
	});

	it("handles !play errors for missing clips and wrong-channel clips", async () => {
		const { handleCommand } = await loadCommands();
		handleClip.mockResolvedValueOnce({ errorCode: 3 });
		await handleCommand(buildMessage("!play https://clips.twitch.tv/missing"));
		expect(sendChatMessage).toHaveBeenCalledWith("owner-1", expect.stringContaining("could not be found"));

		handleClip.mockResolvedValueOnce({ errorCode: 4 });
		await handleCommand(buildMessage("!play https://clips.twitch.tv/other-channel"));
		expect(sendChatMessage).toHaveBeenCalledWith("owner-1", expect.stringContaining("only use clips taken from this channel"));
	});

	it("reports queue as empty when both mod and reward queues are empty", async () => {
		getModQueue.mockResolvedValue([]);
		getAllOverlayIdsByOwnerServer.mockResolvedValue(["overlay-1"]);
		getClipQueueByOverlayId.mockResolvedValue([]);
		const { handleCommand } = await loadCommands();
		await handleCommand(buildMessage("!queue"));
		expect(sendChatMessage).toHaveBeenCalledWith("owner-1", expect.stringContaining("queue is currently empty"));
	});

	it("lists mod and reward queue titles and falls back to unknown clip labels", async () => {
		getModQueue.mockResolvedValue([{ clipId: "mod-clip-1" }]);
		getAllOverlayIdsByOwnerServer.mockResolvedValue(["overlay-1"]);
		getClipQueueByOverlayId.mockResolvedValue([{ clipId: "reward-clip-1" }]);
		getTwitchClip
			.mockResolvedValueOnce({ id: "mod-clip-1", title: "Mod Clip" })
			.mockResolvedValueOnce(null);

		const { handleCommand } = await loadCommands();
		await handleCommand(buildMessage("!queue"));

		expect(sendChatMessage).toHaveBeenCalledWith(
			"owner-1",
			expect.stringContaining("Mod Queue [Mod Clip] | Reward Queue [Unknown Clip]"),
		);
	});

	it("clears only reward queues for !clearqueue reward", async () => {
		getAllOverlayIdsByOwnerServer.mockResolvedValue(["overlay-1", "overlay-2"]);
		const { handleCommand } = await loadCommands();
		await handleCommand(buildMessage("!clearqueue reward"));
		expect(clearClipQueueByOverlayIdServer).toHaveBeenCalledTimes(2);
		expect(clearModQueueByBroadcasterId).not.toHaveBeenCalled();
		expect(sendChatMessage).toHaveBeenCalledWith("owner-1", expect.stringContaining("reward queue has been cleared"));
	});

	it("clears both queues for !clearqueue without args", async () => {
		getAllOverlayIdsByOwnerServer.mockResolvedValue(["overlay-1"]);
		const { handleCommand } = await loadCommands();
		await handleCommand(buildMessage("!clearqueue"));
		expect(clearClipQueueByOverlayIdServer).toHaveBeenCalledWith("overlay-1");
		expect(clearModQueueByBroadcasterId).toHaveBeenCalledWith("owner-1");
		expect(sendChatMessage).toHaveBeenCalledWith("owner-1", expect.stringContaining("queue has been cleared"));
	});

	it("reports invalid clearqueue options", async () => {
		const { handleCommand } = await loadCommands();
		await handleCommand(buildMessage("!clearqueue nope"));
		expect(sendChatMessage).toHaveBeenCalledWith("owner-1", expect.stringContaining("invalid option"));
	});

	it("shows mixed overlay volumes for !volume with no args", async () => {
		getAllOverlaysByOwnerServer.mockResolvedValue([{ playerVolume: 20 }, { playerVolume: 80 }]);
		const { handleCommand } = await loadCommands();
		await handleCommand(buildMessage("!volume"));
		expect(sendChatMessage).toHaveBeenCalledWith("owner-1", expect.stringContaining("mixed volumes (20, 80)"));
	});

	it("validates !volume numeric input and handles missing overlays", async () => {
		getAllOverlaysByOwnerServer.mockResolvedValueOnce([]).mockResolvedValueOnce([{ playerVolume: 50 }]);
		const { handleCommand } = await loadCommands();

		await handleCommand(buildMessage("!volume"));
		expect(sendChatMessage).toHaveBeenCalledWith("owner-1", expect.stringContaining("no overlays found"));

		await handleCommand(buildMessage("!volume loud"));
		expect(sendChatMessage).toHaveBeenCalledWith("owner-1", expect.stringContaining("valid number between 0 and 100"));
	});

	it("clamps !volume values and broadcasts updates", async () => {
		getAllOverlaysByOwnerServer.mockResolvedValue([{ playerVolume: 40 }]);
		const { handleCommand } = await loadCommands();
		await handleCommand(buildMessage("!volume 130"));
		expect(setPlayerVolumeForOwner).toHaveBeenCalledWith("owner-1", 100);
		expect(sendMessage).toHaveBeenCalledWith("command", { name: "volume", data: "100" }, "owner-1");
		expect(sendChatMessage).toHaveBeenCalledWith("owner-1", expect.stringContaining("100%"));
	});
});
