"use server";

import { TwitchMessage } from "@types";

export async function isCommand(message: TwitchMessage): Promise<boolean> {
	if (message.message.fragments[0].type === "mention" && message.message.fragments[0].mention?.user_id === process.env.TWITCH_USER_ID) {
		return true;
	}
	return false;
}
