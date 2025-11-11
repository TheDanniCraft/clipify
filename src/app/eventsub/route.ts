import { NextRequest } from "next/server";
import crypto from "crypto";
import { handleClip, sendChatMessage, updateRedemptionStatus } from "@actions/twitch";
import { addToClipQueue, getOverlayByRewardId } from "@actions/database";
import { RewardStatus } from "@types";
import { sendMessage } from "@actions/websocket";
import { handleCommand, isCommand, isMod } from "@actions/commands";

const SECRET = process.env.WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
	if (!SECRET) {
		console.error("Webhook secret is not configured.");
		return new Response("Webhook secret not configured", { status: 500 });
	}

	const messageId = request.headers.get("Twitch-Eventsub-Message-Id");
	const timestamp = request.headers.get("Twitch-Eventsub-Message-Timestamp");
	const signature = request.headers.get("Twitch-Eventsub-Message-Signature");
	const messageType = request.headers.get("Twitch-Eventsub-Message-Type");

	if (!messageId || !timestamp || !signature || !messageType) {
		console.error("Missing required headers:", {
			messageId,
			timestamp,
			signature,
			messageType,
		});
		return new Response("Missing required headers", { status: 400 });
	}

	const body = await request.text();
	const message = messageId + timestamp + body;

	const hmac = crypto.createHmac("sha256", SECRET).update(message).digest("hex");
	const expectedSignature = `sha256=${hmac}`;

	if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
		console.error("Invalid signature:", { signature, expectedSignature });
		return new Response("Invalid signature", { status: 403 });
	}

	switch (messageType) {
		case "notification": {
			const notification = JSON.parse(body);

			switch (notification.subscription.type) {
				case "channel.chat.message": {
					if ((await isCommand(notification.event)) && (await isMod(notification.event))) {
						handleCommand(notification.event);
					}
					break;
				}

				case "channel.channel_points_custom_reward_redemption.add": {
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
				}
			}

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
