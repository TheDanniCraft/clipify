"use server";

import { TwitchBadge, TwitchMessage } from "@types";
import { sendMessage } from "@actions/websocket";
import { getTwitchClip, handleClip, sendChatMessage } from "@actions/twitch";
import { addToModQueue, clearClipQueueByOverlayIdServer, clearModQueueByBroadcasterId, getAllOverlayIdsByOwnerServer, getAllOverlaysByOwnerServer, getClipQueueByOverlayId, getModQueue, getSettings, getUserByIdServer, setPlayerVolumeForOwner } from "@actions/database";
import { getFeatureAccess } from "@lib/featureAccess";
import { getBaseUrl } from "@actions/utils";

const CHAT_COMMAND_ACCESS_TTL_MS = 60_000;
const CHAT_COMMAND_ACCESS_MAX_ENTRIES = 1000;
const UPGRADE_MESSAGE_COOLDOWN_MS = 30_000;
const chatCommandAccessCache = new Map<string, { allowed: boolean; expiresAt: number }>();
const upgradeMessageCooldownByUser = new Map<string, number>();
let cachedUpgradeUrl: string | null = null;
let nextChatCommandCacheCleanupAt = 0;
let nextUpgradeMessageCleanupAt = 0;

async function getPrefix(userId: string): Promise<string | null> {
	const settings = await getSettings(userId);
	return settings ? settings.prefix : null;
}

async function getUpgradeSettingsUrl() {
	if (cachedUpgradeUrl) return cachedUpgradeUrl;
	cachedUpgradeUrl = new URL("/dashboard/settings", await getBaseUrl()).toString();
	return cachedUpgradeUrl;
}

async function canUseChatCommands(userId: string) {
	const now = Date.now();
	if (now >= nextChatCommandCacheCleanupAt) {
		nextChatCommandCacheCleanupAt = now + CHAT_COMMAND_ACCESS_TTL_MS;
		for (const [key, entry] of chatCommandAccessCache) {
			if (entry.expiresAt <= now) {
				chatCommandAccessCache.delete(key);
			}
		}
	}

	while (chatCommandAccessCache.size > CHAT_COMMAND_ACCESS_MAX_ENTRIES) {
		const oldestKey = chatCommandAccessCache.keys().next().value as string | undefined;
		if (!oldestKey) break;
		chatCommandAccessCache.delete(oldestKey);
	}

	const cached = chatCommandAccessCache.get(userId);
	if (cached && cached.expiresAt > now) {
		return cached.allowed;
	}
	if (cached && cached.expiresAt <= now) {
		chatCommandAccessCache.delete(userId);
	}

	const user = await getUserByIdServer(userId);
	if (!user) return null;
	const allowed = getFeatureAccess(user, "chat_commands").allowed;
	chatCommandAccessCache.set(userId, { allowed, expiresAt: now + CHAT_COMMAND_ACCESS_TTL_MS });
	return allowed;
}

function canSendUpgradeMessage(broadcasterUserId: string, chatterUserId: string) {
	const now = Date.now();
	if (now >= nextUpgradeMessageCleanupAt) {
		nextUpgradeMessageCleanupAt = now + UPGRADE_MESSAGE_COOLDOWN_MS;
		for (const [key, until] of upgradeMessageCooldownByUser) {
			if (until <= now) {
				upgradeMessageCooldownByUser.delete(key);
			}
		}
	}

	const key = `${broadcasterUserId}:${chatterUserId}`;
	const until = upgradeMessageCooldownByUser.get(key) ?? 0;
	if (until > now) return false;
	upgradeMessageCooldownByUser.set(key, now + UPGRADE_MESSAGE_COOLDOWN_MS);
	return true;
}

export async function isCommand(message: TwitchMessage): Promise<boolean> {
	const prefix = await getPrefix(message.broadcaster_user_id);
	if (!prefix) return false;
	if (message.message.fragments[0].type === "text" && message.message.fragments[0].text.startsWith(prefix)) {
		return true;
	}
	return false;
}

export async function isMod(message: TwitchMessage): Promise<boolean> {
	const isBroadcaster = message.chatter_user_id === message.broadcaster_user_id;

	const hasModBadge = message.badges?.some((badge: TwitchBadge) => badge.set_id === "moderator");

	return isBroadcaster || Boolean(hasModBadge);
}

export async function handleCommand(message: TwitchMessage): Promise<void> {
	const firstFragment = message.message.fragments[0];
	const prefix = await getPrefix(message.broadcaster_user_id);
	if (!prefix) return;

	if (firstFragment.type === "text" && firstFragment.text.startsWith(prefix)) {
		const allowed = await canUseChatCommands(message.broadcaster_user_id);
		if (allowed == null) return;
		if (!allowed) {
			if (canSendUpgradeMessage(message.broadcaster_user_id, message.chatter_user_id)) {
				const upgradeUrl = await getUpgradeSettingsUrl();
				await sendChatMessage(message.broadcaster_user_id, `@${message.chatter_user_name} chat commands are a Pro feature. Upgrade in dashboard settings: ${upgradeUrl}`);
			}
			return;
		}

		const commandName = firstFragment.text.slice(prefix.length).trimStart().split(/\s+/)?.[0]?.toLowerCase();
		const command = commands[commandName];
		if (command) {
			await command.execute(message, prefix);
		} else {
			await sendChatMessage(message.broadcaster_user_id, `@${message.chatter_user_name} unknown command. Use "${prefix}help" to see the list of available commands.`);
		}
	}
}

const commands: Record<string, { description: string; usage: string; execute: (message: TwitchMessage, prefix: string) => Promise<void> }> = {
	play: {
		description: "Play a clip or resume playback",
		usage: "play <[clip_url]>",
		execute: async (message: TwitchMessage) => {
			const text = message.message.text;
			const args = text.split(/\s+/).filter(Boolean).slice(1);

			if (args.length === 0) {
				await sendMessage("command", { name: "play", data: null }, message.broadcaster_user_id);

				await sendChatMessage(message.broadcaster_user_id, `@${message.chatter_user_name} playback has been resumed!`);
				return;
			}

			if (args[0]) {
				const clip = await handleClip(args[0], message.broadcaster_user_id);

				if ("errorCode" in clip && (clip.errorCode === 1 || clip.errorCode === 2)) {
					await sendChatMessage(message.broadcaster_user_id, `@${message.chatter_user_name} please provide a valid Twitch clip URL.`);
					return;
				}

				if ("errorCode" in clip && clip.errorCode === 3) {
					await sendChatMessage(message.broadcaster_user_id, `@${message.chatter_user_name} the requested clip could not be found.`);
					return;
				}

				if ("errorCode" in clip && clip.errorCode === 4) {
					await sendChatMessage(message.broadcaster_user_id, `@${message.chatter_user_name} you can only use clips taken from this channel.`);
					return;
				}

				if (!("errorCode" in clip)) {
					await sendMessage("command", { name: "play", data: { clip } }, message.broadcaster_user_id);
					await addToModQueue(message.broadcaster_user_id, clip.id);

					await sendChatMessage(message.broadcaster_user_id, `@${message.chatter_user_name} the clip (${clip.title}) has been added to the queue!`);
				}
			}
		},
	},

	pause: {
		description: "Pause playback",
		usage: "pause",
		execute: async (message: TwitchMessage) => {
			const text = message.message.text;
			const args = text.split(/\s+/).filter(Boolean).slice(1);

			if (args.length === 0) {
				await sendMessage("command", { name: "pause", data: null }, message.broadcaster_user_id);

				await sendChatMessage(message.broadcaster_user_id, `@${message.chatter_user_name} playback has been paused!`);
				return;
			}
		},
	},

	skip: {
		description: "Skip the current clip",
		usage: "skip",
		execute: async (message: TwitchMessage) => {
			const text = message.message.text;
			const args = text.split(/\s+/).filter(Boolean).slice(1);

			if (args.length === 0) {
				await sendMessage("command", { name: "skip", data: null }, message.broadcaster_user_id);

				await sendChatMessage(message.broadcaster_user_id, `@${message.chatter_user_name} the current clip has been skipped!`);
				return;
			}
		},
	},

	hide: {
		description: "Hide the player",
		usage: "hide",
		execute: async (message: TwitchMessage) => {
			const text = message.message.text;
			const args = text.split(/\s+/).filter(Boolean).slice(1);

			if (args.length === 0) {
				await sendMessage("command", { name: "hide", data: null }, message.broadcaster_user_id);

				await sendChatMessage(message.broadcaster_user_id, `@${message.chatter_user_name} the player has been hidden!`);
				return;
			}
		},
	},

	show: {
		description: "Show the player",
		usage: "show",
		execute: async (message: TwitchMessage) => {
			const text = message.message.text;
			const args = text.split(/\s+/).filter(Boolean).slice(1);

			if (args.length === 0) {
				await sendMessage("command", { name: "show", data: null }, message.broadcaster_user_id);

				await sendChatMessage(message.broadcaster_user_id, `@${message.chatter_user_name} the player has been shown!`);
				return;
			}
		},
	},

	queue: {
		description: "Show the current queue",
		usage: "queue",
		execute: async (message: TwitchMessage) => {
			const text = message.message.text;
			const args = text.split(/\s+/).filter(Boolean).slice(1);

			if (args.length === 0) {
				const modQue = await getModQueue(message.broadcaster_user_id);
				const rewardQue = [];

				const overlayIds = await getAllOverlayIdsByOwnerServer(message.broadcaster_user_id);

				if (overlayIds) {
					for (const overlayId of overlayIds) {
						rewardQue.push(...(await getClipQueueByOverlayId(overlayId)));
					}
				}

				if (modQue.length === 0 && rewardQue.length === 0) {
					await sendChatMessage(message.broadcaster_user_id, `@${message.chatter_user_name} the queue is currently empty!`);
					return;
				}

				const modQueueReply = modQue.length
					? `Mod Queue [${(
							await Promise.all(
								modQue.map(async (clip) => {
									const twitchClip = await getTwitchClip(clip.clipId, message.broadcaster_user_id);
									return twitchClip ? twitchClip.title : "Unknown Clip";
								})
							)
					  ).join(", ")}]`
					: "Mod Queue [empty]";

				const rewardQueueReply = rewardQue.length
					? `Reward Queue [${(
							await Promise.all(
								rewardQue.map(async (clip) => {
									const twitchClip = await getTwitchClip(clip.clipId, message.broadcaster_user_id);
									return twitchClip ? twitchClip.title : "Unknown Clip";
								})
							)
					  ).join(", ")}]`
					: "Reward Queue [empty]";

				const reply = `${modQueueReply} | ${rewardQueueReply}`;

				await sendChatMessage(message.broadcaster_user_id, `@${message.chatter_user_name} ${reply}`);
			}
		},
	},

	clearqueue: {
		description: "Clear the queue",
		usage: "clearqueue <mod|reward>",
		execute: async (message: TwitchMessage) => {
			const text = message.message.text;
			const args = text.split(/\s+/).filter(Boolean).slice(1);

			if (args.length === 0) {
				const overlayIds = await getAllOverlayIdsByOwnerServer(message.broadcaster_user_id);
				if (overlayIds && overlayIds.length > 0) {
					await Promise.all(overlayIds.map((overlayId) => clearClipQueueByOverlayIdServer(overlayId)));
				}
				await clearModQueueByBroadcasterId(message.broadcaster_user_id);

				await sendChatMessage(message.broadcaster_user_id, `@${message.chatter_user_name} the queue has been cleared!`);
				return;
			}

			switch (args[0].toLowerCase()) {
				case "mod": {
					await clearModQueueByBroadcasterId(message.broadcaster_user_id);
					await sendChatMessage(message.broadcaster_user_id, `@${message.chatter_user_name} the mod queue has been cleared!`);
					return;
				}
				case "reward": {
					const overlayIds = await getAllOverlayIdsByOwnerServer(message.broadcaster_user_id);
					if (overlayIds && overlayIds.length > 0) {
						await Promise.all(overlayIds.map((overlayId) => clearClipQueueByOverlayIdServer(overlayId)));
					}
					await sendChatMessage(message.broadcaster_user_id, `@${message.chatter_user_name} the reward queue has been cleared!`);
					return;
				}
				default: {
					await sendChatMessage(message.broadcaster_user_id, `@${message.chatter_user_name} invalid option. Use "clearqueue mod" or "clearqueue reward".`);
					return;
				}
			}
		},
	},

	volume: {
		description: "Show or set player volume (0-100)",
		usage: "volume <[0-100]>",
		execute: async (message: TwitchMessage) => {
			const text = message.message.text;
			const args = text.split(/\s+/).filter(Boolean).slice(1);
			const overlays = await getAllOverlaysByOwnerServer(message.broadcaster_user_id);

			if (!overlays || overlays.length === 0) {
				await sendChatMessage(message.broadcaster_user_id, `@${message.chatter_user_name} no overlays found for this channel.`);
				return;
			}

			if (args.length === 0) {
				const uniqueVolumes = Array.from(new Set(overlays.map((o) => o.playerVolume)));
				if (uniqueVolumes.length === 1) {
					await sendChatMessage(message.broadcaster_user_id, `@${message.chatter_user_name} current player volume is ${uniqueVolumes[0]}%. Use "volume <0-100>" to change it.`);
					return;
				}
				await sendChatMessage(message.broadcaster_user_id, `@${message.chatter_user_name} overlays currently have mixed volumes (${uniqueVolumes.join(", ")}). Use "volume <0-100>" to set all.`);
				return;
			}

			const requestedVolume = Number.parseInt(args[0] || "", 10);
			if (!Number.isFinite(requestedVolume)) {
				await sendChatMessage(message.broadcaster_user_id, `@${message.chatter_user_name} please provide a valid number between 0 and 100.`);
				return;
			}

			const clampedVolume = Math.max(0, Math.min(100, requestedVolume));
			await setPlayerVolumeForOwner(message.broadcaster_user_id, clampedVolume);
			await sendMessage("command", { name: "volume", data: String(clampedVolume) }, message.broadcaster_user_id);
			await sendChatMessage(message.broadcaster_user_id, `@${message.chatter_user_name} player volume set to ${clampedVolume}% for all overlays.`);
		},
	},

	volue: {
		description: "Alias for volume",
		usage: "volue <[0-100]>",
		execute: async (message: TwitchMessage, prefix: string) => {
			await commands.volume.execute(message, prefix);
		},
	},

	vboluem: {
		description: "Alias for volume",
		usage: "vboluem <[0-100]>",
		execute: async (message: TwitchMessage, prefix: string) => {
			await commands.volume.execute(message, prefix);
		},
	},

	help: {
		description: "Show help information",
		usage: "help",
		execute: async (message: TwitchMessage, prefix: string) => {
			const commandList = Object.entries(commands)
				.map(([, { usage, description }]) => `${prefix}${usage}: ${description}`)
				.join(" | ");

			await sendChatMessage(message.broadcaster_user_id, `Available commands (<[param]> are optional): ${commandList}`);
		},
	},
};
