/** @jest-environment node */

import crypto from "crypto";

const cacheClipFromEventSub = jest.fn();
const handleClip = jest.fn();
const sendChatMessage = jest.fn();
const updateRedemptionStatus = jest.fn();
const addToClipQueue = jest.fn();
const getOverlayByRewardId = jest.fn();
const sendMessage = jest.fn();
const handleCommand = jest.fn();
const isCommand = jest.fn();
const isMod = jest.fn();

jest.mock("@actions/twitch", () => ({
	cacheClipFromEventSub: (...args: unknown[]) => cacheClipFromEventSub(...args),
	handleClip: (...args: unknown[]) => handleClip(...args),
	sendChatMessage: (...args: unknown[]) => sendChatMessage(...args),
	updateRedemptionStatus: (...args: unknown[]) => updateRedemptionStatus(...args),
}));

jest.mock("@actions/database", () => ({
	addToClipQueue: (...args: unknown[]) => addToClipQueue(...args),
	getOverlayByRewardId: (...args: unknown[]) => getOverlayByRewardId(...args),
}));

jest.mock("@actions/websocket", () => ({
	sendMessage: (...args: unknown[]) => sendMessage(...args),
}));

jest.mock("@actions/commands", () => ({
	handleCommand: (...args: unknown[]) => handleCommand(...args),
	isCommand: (...args: unknown[]) => isCommand(...args),
	isMod: (...args: unknown[]) => isMod(...args),
}));

function signBody(secret: string, messageId: string, timestamp: string, body: string) {
	const digest = crypto.createHmac("sha256", secret).update(messageId + timestamp + body).digest("hex");
	return `sha256=${digest}`;
}

function createSignedRequest(secret: string, messageType: string, body: string) {
	const messageId = "msg-1";
	const timestamp = "2026-03-09T10:00:00.000Z";
	const signature = signBody(secret, messageId, timestamp, body);
	const headers = new Headers({
		"Twitch-Eventsub-Message-Id": messageId,
		"Twitch-Eventsub-Message-Timestamp": timestamp,
		"Twitch-Eventsub-Message-Signature": signature,
		"Twitch-Eventsub-Message-Type": messageType,
	});
	return new Request("http://localhost/eventsub", { method: "POST", headers, body });
}

async function loadRoute(secret?: string) {
	jest.resetModules();
	if (secret == null) delete process.env.WEBHOOK_SECRET;
	else process.env.WEBHOOK_SECRET = secret;
	return import("@/app/eventsub/route");
}

describe("app/eventsub route", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("returns 500 when webhook secret is missing", async () => {
		const { POST } = await loadRoute(undefined);
		const req = new Request("http://localhost/eventsub", { method: "POST", body: "{}" });
		const res = await POST(req as never);
		expect(res.status).toBe(500);
	});

	it("returns 400 when required headers are missing", async () => {
		const { POST } = await loadRoute("secret");
		const req = new Request("http://localhost/eventsub", { method: "POST", body: "{}" });
		const res = await POST(req as never);
		expect(res.status).toBe(400);
	});

	it("returns 403 for invalid signature", async () => {
		const { POST } = await loadRoute("secret");
		const headers = new Headers({
			"Twitch-Eventsub-Message-Id": "msg-1",
			"Twitch-Eventsub-Message-Timestamp": "2026-03-09T10:00:00.000Z",
			"Twitch-Eventsub-Message-Signature": "sha256=invalid",
			"Twitch-Eventsub-Message-Type": "notification",
		});
		const req = new Request("http://localhost/eventsub", { method: "POST", headers, body: "{}" });
		const res = await POST(req as never);
		expect(res.status).toBe(403);
	});

	it("returns 403 when signature parsing throws internally", async () => {
		const { POST } = await loadRoute("secret");
		const realBufferFrom = Buffer.from.bind(Buffer);
		const fromSpy = jest.spyOn(Buffer, "from").mockImplementation(((...args: unknown[]) => {
			const value = args[0];
			if (typeof value === "string" && value.startsWith("sha256=")) {
				throw new Error("buffer parse failed");
			}
			return realBufferFrom(...(args as Parameters<typeof Buffer.from>));
		}) as typeof Buffer.from);

		try {
			const req = createSignedRequest("secret", "notification", "{}");
			const res = await POST(req as never);
			expect(res.status).toBe(403);
		} finally {
			fromSpy.mockRestore();
		}
	});

	it("responds to callback verification challenges", async () => {
		const { POST } = await loadRoute("secret");
		const body = JSON.stringify({ challenge: "verify-me" });
		const req = createSignedRequest("secret", "webhook_callback_verification", body);
		const res = await POST(req as never);
		expect(res.status).toBe(200);
		await expect(res.text()).resolves.toBe("verify-me");
	});

	it("returns 400 for malformed notification payload JSON", async () => {
		const { POST } = await loadRoute("secret");
		const req = createSignedRequest("secret", "notification", "{");
		const res = await POST(req as never);

		expect(res.status).toBe(400);
		await expect(res.text()).resolves.toBe("Invalid JSON payload");
	});

	it("returns 400 for malformed callback verification payload JSON", async () => {
		const { POST } = await loadRoute("secret");
		const req = createSignedRequest("secret", "webhook_callback_verification", "{");
		const res = await POST(req as never);

		expect(res.status).toBe(400);
		await expect(res.text()).resolves.toBe("Invalid JSON payload");
	});

	it("returns 400 for malformed revocation payload JSON", async () => {
		const { POST } = await loadRoute("secret");
		const req = createSignedRequest("secret", "revocation", "{");
		const res = await POST(req as never);

		expect(res.status).toBe(400);
		await expect(res.text()).resolves.toBe("Invalid JSON payload");
	});

	it("processes clip-create notifications and caches clip", async () => {
		const { POST } = await loadRoute("secret");
		const body = JSON.stringify({
			subscription: { type: "channel.clip.create" },
			event: { id: "clip-1", broadcaster_user_id: "owner-1" },
		});
		const req = createSignedRequest("secret", "notification", body);
		const res = await POST(req as never);
		expect(res.status).toBe(204);
		expect(cacheClipFromEventSub).toHaveBeenCalledWith("clip-1", "owner-1");
	});

	it("runs chat command handling only for mod commands", async () => {
		const { POST } = await loadRoute("secret");
		isCommand.mockResolvedValue(true);
		isMod.mockResolvedValue(true);

		const body = JSON.stringify({
			subscription: { type: "channel.chat.message" },
			event: { message: { text: "!help", fragments: [{ type: "text", text: "!help" }] } },
		});

		const req = createSignedRequest("secret", "notification", body);
		const res = await POST(req as never);
		expect(res.status).toBe(204);
		expect(handleCommand).toHaveBeenCalledTimes(1);
	});

	it("ignores chat command notifications for non-mod or non-command messages", async () => {
		const { POST } = await loadRoute("secret");
		isCommand.mockResolvedValue(true);
		isMod.mockResolvedValue(false);

		const nonModBody = JSON.stringify({
			subscription: { type: "channel.chat.message" },
			event: { message: { text: "!help", fragments: [{ type: "text", text: "!help" }] } },
		});

		const nonModReq = createSignedRequest("secret", "notification", nonModBody);
		const nonModRes = await POST(nonModReq as never);
		expect(nonModRes.status).toBe(204);
		expect(handleCommand).not.toHaveBeenCalled();

		isCommand.mockResolvedValue(false);
		isMod.mockResolvedValue(true);
		const plainBody = JSON.stringify({
			subscription: { type: "channel.chat.message" },
			event: { message: { text: "hello", fragments: [{ type: "text", text: "hello" }] } },
		});
		const plainReq = createSignedRequest("secret", "notification", plainBody);
		const plainRes = await POST(plainReq as never);
		expect(plainRes.status).toBe(204);
		expect(handleCommand).not.toHaveBeenCalled();
	});

	it("ignores clip-create notifications with incomplete payloads", async () => {
		const { POST } = await loadRoute("secret");
		const body = JSON.stringify({
			subscription: { type: "channel.clip.create" },
			event: { id: "clip-1" },
		});
		const req = createSignedRequest("secret", "notification", body);
		const res = await POST(req as never);
		expect(res.status).toBe(204);
		expect(cacheClipFromEventSub).not.toHaveBeenCalled();
	});

	it("keeps webhook successful when clip cache update throws", async () => {
		const { POST } = await loadRoute("secret");
		cacheClipFromEventSub.mockRejectedValue(new Error("cache down"));
		const body = JSON.stringify({
			subscription: { type: "channel.clip.create" },
			event: { id: "clip-1", broadcaster_user_id: "owner-1" },
		});
		const req = createSignedRequest("secret", "notification", body);
		const res = await POST(req as never);

		expect(res.status).toBe(204);
	});

	it("cancels reward redemption when user input is missing", async () => {
		const { POST } = await loadRoute("secret");
		getOverlayByRewardId.mockResolvedValue({ id: "overlay-1", ownerId: "owner-1", rewardId: "reward-1" });

		const body = JSON.stringify({
			subscription: { type: "channel.channel_points_custom_reward_redemption.add" },
			event: {
				id: "redemption-1",
				broadcaster_user_id: "owner-1",
				user_name: "viewer1",
				reward: { id: "reward-1" },
			},
		});

		const req = createSignedRequest("secret", "notification", body);
		const res = await POST(req as never);
		expect(res.status).toBe(200);
		expect(updateRedemptionStatus).toHaveBeenCalled();
		expect(sendChatMessage).toHaveBeenCalled();
	});

	it("cancels reward redemption when clip handler reports invalid URL", async () => {
		const { POST } = await loadRoute("secret");
		getOverlayByRewardId.mockResolvedValue({ id: "overlay-1", ownerId: "owner-1", rewardId: "reward-1" });
		handleClip.mockResolvedValue({ errorCode: 1 });

		const body = JSON.stringify({
			subscription: { type: "channel.channel_points_custom_reward_redemption.add" },
			event: {
				id: "redemption-2",
				broadcaster_user_id: "owner-1",
				user_name: "viewer2",
				user_input: "bad-url",
				reward: { id: "reward-1" },
			},
		});

		const req = createSignedRequest("secret", "notification", body);
		const res = await POST(req as never);
		expect(res.status).toBe(200);
		expect(updateRedemptionStatus).toHaveBeenCalled();
	});

	it("cancels reward redemption for missing and wrong-channel clips", async () => {
		const { POST } = await loadRoute("secret");
		getOverlayByRewardId.mockResolvedValue({ id: "overlay-1", ownerId: "owner-1", rewardId: "reward-1" });

		handleClip.mockResolvedValueOnce({ errorCode: 3 });
		const missingBody = JSON.stringify({
			subscription: { type: "channel.channel_points_custom_reward_redemption.add" },
			event: {
				id: "redemption-3a",
				broadcaster_user_id: "owner-1",
				user_name: "viewer3a",
				user_input: "https://clips.twitch.tv/missing",
				reward: { id: "reward-1" },
			},
		});
		const missingReq = createSignedRequest("secret", "notification", missingBody);
		const missingRes = await POST(missingReq as never);
		expect(missingRes.status).toBe(200);
		expect(sendChatMessage).toHaveBeenCalledWith(
			"owner-1",
			expect.stringContaining("requested clip could not be found"),
		);

		handleClip.mockResolvedValueOnce({ errorCode: 4 });
		const wrongChannelBody = JSON.stringify({
			subscription: { type: "channel.channel_points_custom_reward_redemption.add" },
			event: {
				id: "redemption-3b",
				broadcaster_user_id: "owner-1",
				user_name: "viewer3b",
				user_input: "https://clips.twitch.tv/other",
				reward: { id: "reward-1" },
			},
		});
		const wrongChannelReq = createSignedRequest("secret", "notification", wrongChannelBody);
		const wrongChannelRes = await POST(wrongChannelReq as never);
		expect(wrongChannelRes.status).toBe(200);
		expect(sendChatMessage).toHaveBeenCalledWith(
			"owner-1",
			expect.stringContaining("only use clips taken from this channel"),
		);
		expect(updateRedemptionStatus).toHaveBeenCalledTimes(2);
	});

	it("returns 204 when reward redemption cannot be matched to an overlay", async () => {
		const { POST } = await loadRoute("secret");
		getOverlayByRewardId.mockResolvedValue(null);

		const body = JSON.stringify({
			subscription: { type: "channel.channel_points_custom_reward_redemption.add" },
			event: {
				id: "redemption-miss",
				broadcaster_user_id: "owner-1",
				user_name: "viewer4",
				user_input: "https://clips.twitch.tv/clip",
				reward: { id: "reward-missing" },
			},
		});

		const req = createSignedRequest("secret", "notification", body);
		const res = await POST(req as never);
		expect(res.status).toBe(204);
		expect(addToClipQueue).not.toHaveBeenCalled();
		expect(updateRedemptionStatus).not.toHaveBeenCalled();
	});

	it("swallows reward-processing exceptions and keeps webhook successful", async () => {
		const { POST } = await loadRoute("secret");
		getOverlayByRewardId.mockRejectedValue(new Error("database unavailable"));

		const body = JSON.stringify({
			subscription: { type: "channel.channel_points_custom_reward_redemption.add" },
			event: {
				id: "redemption-err",
				broadcaster_user_id: "owner-1",
				user_name: "viewer5",
				user_input: "https://clips.twitch.tv/clip",
				reward: { id: "reward-1" },
			},
		});

		const req = createSignedRequest("secret", "notification", body);
		const res = await POST(req as never);
		expect(res.status).toBe(204);
	});

	it("queues valid reward redemption clips and fulfills redemption", async () => {
		const { POST } = await loadRoute("secret");
		getOverlayByRewardId.mockResolvedValue({ id: "overlay-1", ownerId: "owner-1", rewardId: "reward-1" });
		handleClip.mockResolvedValue({ id: "clip-9", title: "Great clip" });

		const body = JSON.stringify({
			subscription: { type: "channel.channel_points_custom_reward_redemption.add" },
			event: {
				id: "redemption-3",
				broadcaster_user_id: "owner-1",
				user_name: "viewer3",
				user_input: "https://clips.twitch.tv/clip",
				reward: { id: "reward-1" },
			},
		});

		const req = createSignedRequest("secret", "notification", body);
		const res = await POST(req as never);
		expect(res.status).toBe(204);
		expect(addToClipQueue).toHaveBeenCalledWith("overlay-1", "clip-9");
		expect(sendMessage).toHaveBeenCalledWith("new_clip_redemption", { clipId: "clip-9" }, "owner-1");
		expect(updateRedemptionStatus).toHaveBeenCalled();
	});

	it("handles revocation and unknown message types", async () => {
		const { POST } = await loadRoute("secret");
		const revocationBody = JSON.stringify({
			subscription: { type: "channel.clip.create", status: "authorization_revoked", condition: { broadcaster_user_id: "1" } },
		});
		const revocationReq = createSignedRequest("secret", "revocation", revocationBody);
		const revocationRes = await POST(revocationReq as never);
		expect(revocationRes.status).toBe(204);

		const unknownReq = createSignedRequest("secret", "unknown-type", "{}");
		const unknownRes = await POST(unknownReq as never);
		expect(unknownRes.status).toBe(200);
	});
});
