import "server-only";
import { awardChatMessageSchema as schema, type AwardChatMessage } from "@/app/lib/eventChat";
type Channel = { activeUntil: number; messages: AwardChatMessage[] };
declare global {
	var __awardChat: Map<string, Channel> | undefined;
}
// shortcut: like existing overlay subscriptions this is process-local; use shared pubsub before deploying replicas.
const channels = globalThis.__awardChat ?? (globalThis.__awardChat = new Map<string, Channel>());
export function activateAwardChat(ownerId: string, now = Date.now()) {
	for (const [id, channel] of channels) if (channel.activeUntil < now) channels.delete(id);
	if (!channels.has(ownerId) && channels.size >= 100) return false;
	const channel = channels.get(ownerId) ?? { activeUntil: 0, messages: [] };
	channel.activeUntil = now + 30000;
	channels.set(ownerId, channel);
	return true;
}
export function relayAwardChat(input: unknown, now = Date.now()) {
	const parsed = schema.safeParse(input);
	if (!parsed.success) return;
	const data = parsed.data,
		channel = channels.get(data.broadcaster_user_id);
	if (!channel || channel.activeUntil < now) return;
	if (channel.messages.some((message) => message.id === data.message_id)) return;
	channel.messages = [...channel.messages.filter((message) => message.at > now - 60000), { id: data.message_id, userId: data.chatter_user_id, login: data.chatter_user_login.toLowerCase(), name: data.chatter_user_name, color: data.color, text: data.message.text, fragments: data.message.fragments, badges: data.badges, at: now }].slice(-50);
}
export function readAwardChat(ownerId: string, now = Date.now()) {
	const channel = channels.get(ownerId);
	return channel && channel.activeUntil >= now ? channel.messages.filter((message) => message.at > now - 60000) : [];
}
export function filterAwardChat(messages: AwardChatMessage[], settings: { hiddenAccounts: string[]; commandPrefixes: string[] }) {
	return messages.filter((message) => !settings.hiddenAccounts.includes(message.login) && !settings.commandPrefixes.some((prefix) => message.text.trimStart().startsWith(prefix)));
}
