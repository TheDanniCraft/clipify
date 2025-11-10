"use server";

import { TwitchMessage } from "@types";
import { sendMessage } from "@actions/websocket";
import { handleClip, sendChatMessage } from "@actions/twitch";
import { addToModQueue, getSettings } from "@actions/database";

async function getPrefix(userId: string): Promise<string | null> {
	const settings = await getSettings(userId);
	return settings ? settings.prefix : null;
}

export async function isCommand(message: TwitchMessage): Promise<boolean> {
	const prefix = await getPrefix(message.broadcaster_user_id);
	if (!prefix) return false;
	if (message.message.fragments[0].type === "text" && message.message.fragments[0].text.startsWith(prefix)) {
		return true;
	}
	return false;
}

export async function handleCommand(message: TwitchMessage): Promise<void> {
	const firstFragment = message.message.fragments[0];
	const prefix = await getPrefix(message.broadcaster_user_id);
	if (!prefix) return;

	if (firstFragment.type === "text" && firstFragment.text.startsWith(prefix)) {
		const commandName = firstFragment.text.slice(prefix.length).trimStart().split(/\s+/)?.[0]?.toLowerCase();
		const command = commands[commandName];
		if (command) {
			await command.execute(message, prefix);
		} else {
			console.log(`unknown command <${commandName}>`);
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
			console.log(`executed <hide> <[${args.join(", ")}]>`);
		},
	},

	show: {
		description: "Show the player",
		usage: "show",
		execute: async (message: TwitchMessage) => {
			const text = message.message.text;
			const args = text.split(/\s+/).filter(Boolean).slice(1);
			console.log(`executed <show> <[${args.join(", ")}]>`);
		},
	},

	queue: {
		description: "Show the current queue",
		usage: "queue",
		execute: async (message: TwitchMessage) => {
			const text = message.message.text;
			const args = text.split(/\s+/).filter(Boolean).slice(1);
			console.log(`executed <queue> <[${args.join(", ")}]>`);
		},
	},

	addqueue: {
		description: "Add a clip to the queue",
		usage: "addqueue <[clip_url]>",
		execute: async (message: TwitchMessage) => {
			const text = message.message.text;
			const args = text.split(/\s+/).filter(Boolean).slice(1);
			console.log(`executed <addqueue> <[${args.join(", ")}]>`);
		},
	},

	clearqueue: {
		description: "Clear the queue",
		usage: "clearqueue",
		execute: async (message: TwitchMessage) => {
			const text = message.message.text;
			const args = text.split(/\s+/).filter(Boolean).slice(1);
			console.log(`executed <clearqueue> <[${args.join(", ")}]>`);
		},
	},

	help: {
		description: "Show help information",
		usage: "help",
		execute: async (message: TwitchMessage, prefix: string) => {
			const commandList = Object.entries(commands)
				.map(([name, { usage, description }]) => `${prefix}${usage}: ${description}`)
				.join(" | ");

			await sendChatMessage(message.broadcaster_user_id, `Available commands (<[param]> are optional): ${commandList}`);
		},
	},
};
