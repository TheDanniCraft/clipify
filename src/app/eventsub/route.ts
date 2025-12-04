import { NextRequest } from "next/server";
import crypto from "crypto";
import { handleClip, sendChatMessage, updateRedemptionStatus } from "@actions/twitch";
import { addToClipQueue, getOverlayByRewardId } from "@actions/database";
import { RewardStatus } from "@types";
import { sendMessage } from "@actions/websocket";
import { handleCommand, isCommand, isMod } from "@actions/commands";

const SECRET = process.env.WEBHOOK_SECRET;

async function getRequiredHeaders(headers: Headers) {
	// returns an object with values or a Response to return immediately
	const messageId = headers.get("Twitch-Eventsub-Message-Id");
	const timestamp = headers.get("Twitch-Eventsub-Message-Timestamp");
	const signature = headers.get("Twitch-Eventsub-Message-Signature");
	const messageType = headers.get("Twitch-Eventsub-Message-Type");

	if (!messageId || !timestamp || !signature || !messageType) {
		console.error("Missing required headers:", { messageId, timestamp, signature, messageType });
		return { error: new Response("Missing required headers", { status: 400 }) };
	}

	return { messageId, timestamp, signature, messageType };
}

function isValidSignature(signature: string, timestamp: string, messageId: string, body: string) {
	const message = messageId + timestamp + body;
	const hmac = crypto.createHmac("sha256", SECRET!).update(message).digest("hex");
	const expectedSignature = `sha256=${hmac}`;

	try {
		const sigBuf = Buffer.from(signature);
		const expBuf = Buffer.from(expectedSignature);
		if (sigBuf.length !== expBuf.length) return false;
		return crypto.timingSafeEqual(sigBuf, expBuf);
	} catch (err) {
		return false;
	}
}

async function handleRewardRedemption(notification: any): Promise<Response | null> {
	const reward = notification.event;
	const input = reward.user_input;

	try {
		const overlay = await getOverlayByRewardId(reward.reward.id);

		if (overlay) {
			const clip = await handleClip(input, reward.broadcaster_user_id);

			if ("errorCode" in clip && (clip.errorCode === 1 || clip.errorCode === 2)) {
				await sendChatMessage(reward.broadcaster_user_id, `@${reward.user_name} please provide a valid Twitch clip URL. Points have been refunded.`);
				await updateRedemptionStatus(reward.broadcaster_user_id, reward.id, overlay.rewardId!, RewardStatus.CANCELED);
				return new Response("Invalid Twitch clip URL", { status: 200 });
			}

			if ("errorCode" in clip && clip.errorCode === 3) {
				await sendChatMessage(reward.broadcaster_user_id, `@${reward.user_name} the requested clip could not be found. Points have been refunded.`);
				await updateRedemptionStatus(reward.broadcaster_user_id, reward.id, overlay.rewardId!, RewardStatus.CANCELED);
				return new Response("Clip not found", { status: 200 });
			}

			if ("errorCode" in clip && clip.errorCode === 4) {
				await sendChatMessage(reward.broadcaster_user_id, `@${reward.user_name} you can only use clips taken from this channel. Points have been refunded.`);
				await updateRedemptionStatus(reward.broadcaster_user_id, reward.id, overlay.rewardId!, RewardStatus.CANCELED);
				return new Response("Clip does not belong to the specified creator", { status: 200 });
			}

			if (!("errorCode" in clip)) {
				await addToClipQueue(overlay.id, clip.id);
				await sendMessage("new_clip_redemption", { clipId: clip.id }, overlay.ownerId);

				await sendChatMessage(reward.broadcaster_user_id, `@${reward.user_name} your clip (${clip.title}) has been added to the queue!`);
				await updateRedemptionStatus(reward.broadcaster_user_id, reward.id, overlay.rewardId!, RewardStatus.FULFILLED);
			}
		}
	} catch (error) {
		console.error("Error processing reward redemption:", error);
	}

	return null;
}

async function handleNotification(bodyText: string): Promise<Response | null> {
	const notification = JSON.parse(bodyText);

	switch (notification.subscription.type) {
		case "channel.chat.message": {
			if ((await isCommand(notification.event)) && (await isMod(notification.event))) {
				handleCommand(notification.event);
			}
			break;
		}

		case "channel.channel_points_custom_reward_redemption.add": {
			const res = await handleRewardRedemption(notification);
			if (res) return res;
			break;
		}
	}

	return null;
}

export async function POST(request: NextRequest) {
	if (!SECRET) {
		console.error("Webhook secret is not configured.");
		return new Response("Webhook secret not configured", { status: 500 });
	}

	const headersResult = await getRequiredHeaders(request.headers);
	if ("error" in headersResult) return headersResult.error;

	const { messageId, timestamp, signature, messageType } = headersResult as any;

	const body = await request.text();

	// verify signature
	if (!isValidSignature(signature, timestamp, messageId, body)) {
		console.error("Invalid signature:", { signature });
		return new Response("Invalid signature", { status: 403 });
	}

	switch (messageType) {
		case "notification": {
			const notifResponse = await handleNotification(body);
			if (notifResponse) return notifResponse;
			return new Response(null, { status: 204 });
		}
		case "webhook_callback_verification": {
			const challenge = JSON.parse(body).challenge;
			return new Response(challenge, {
				status: 200,
				headers: { "Content-Type": "text/plain" },
			});
		}
		case "revocation": {
			const notification = JSON.parse(body);

			console.log(`${notification.subscription.type} notifications revoked!`);
			console.log(`reason: ${notification.subscription.status}`);
			console.log(`condition: ${JSON.stringify(notification.subscription.condition, null, 4)}`);

			return new Response(null, { status: 204 });
		}
		default: {
			console.log(`Unhandled message type: ${messageType}`);
			return new Response("Unhandled message type", { status: 200 });
		}
	}
}
