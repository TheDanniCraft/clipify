import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { awardEventsTable, usersTable } from "@/db/schema";
import { EventError, eventError, hasAwardPresenterSecret } from "./persistence";
import { activateAwardChat, filterAwardChat, readAwardChat } from "./chat-buffer";
import { hasAwardPreviewToken } from "@/auth/event-preview-token";
import { DEFAULT_AWARD_PRESENTATION } from "@/app/lib/eventConfiguration";
import { getAppAccessToken } from "@/app/actions/twitch";
import { getBaseUrl } from "@/app/actions/utils";
import { isPreview } from "@/app/actions/utils";
import { parseAwardChatCatalog, parseAwardChatBadge, type AwardChatCatalog, type AwardChatBadge, type AwardChatMessage } from "@/app/lib/eventChat";
async function providerJson(url: string, headers?: HeadersInit, body?: unknown, timeout = 10000) {
	const response = await fetch(url, { method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(timeout) });
	if (response.status === 409) return {};
	if (!response.ok) throw new Error("PROVIDER_UNAVAILABLE");
	const reader = response.body?.getReader();
	if (!reader) throw new Error("PROVIDER_UNAVAILABLE");
	let size = 0;
	const chunks: Uint8Array[] = [];
	try {
		while (true) {
			const next = await reader.read();
			if (next.done) break;
			size += next.value.length;
			if (size > 2097152) throw new Error("PROVIDER_UNAVAILABLE");
			chunks.push(next.value);
		}
		return JSON.parse(Buffer.concat(chunks, size).toString("utf8")) as unknown;
	} finally {
		await reader.cancel().catch(() => {});
		reader.releaseLock();
	}
}
export async function authorizeAwardChat(id: string, secret: string, preview = false) {
	if (!z.uuid().safeParse(id).success) throw new EventError("NOT_FOUND");
	const [row] = await db
		.select({ event: awardEventsTable })
		.from(awardEventsTable)
		.innerJoin(usersTable, and(eq(usersTable.id, awardEventsTable.ownerId), eq(usersTable.disabled, false)))
		.where(eq(awardEventsTable.id, id))
		.limit(1);
	if (!row || (preview ? !hasAwardPreviewToken(row.event, secret) : !row.event.publishedAt || !hasAwardPresenterSecret(row.event, secret))) throw new EventError("NOT_FOUND");
	const settings = row.event.configuration.presentation ?? DEFAULT_AWARD_PRESENTATION;
	if (!settings.showChat) throw new EventError("ACCESS_DENIED");
	return { ownerId: row.event.ownerId, settings };
}
const subscriptions = new Map<string, { until: number; pending?: Promise<void> }>();
async function subscribe(ownerId: string, headers: Record<string, string>) {
	for (const [id, value] of subscriptions) if (!value.pending && value.until < Date.now()) subscriptions.delete(id);
	const cached = subscriptions.get(ownerId);
	if (cached?.pending) return cached.pending;
	if (cached && cached.until > Date.now()) return;
	const pending = (async () => {
		const callback = (await isPreview()) ? new URL("/eventsub", await getBaseUrl()).toString() : process.env.TWITCH_EVENTSUB_URL;
		if (!callback || !process.env.WEBHOOK_SECRET || !process.env.TWITCH_USER_ID) throw new Error("PROVIDER_UNAVAILABLE");
		await providerJson("https://api.twitch.tv/helix/eventsub/subscriptions", { ...headers, "Content-Type": "application/json" }, { type: "channel.chat.message", version: "1", condition: { broadcaster_user_id: ownerId, user_id: process.env.TWITCH_USER_ID }, transport: { method: "webhook", callback, secret: process.env.WEBHOOK_SECRET } });
	})();
	subscriptions.set(ownerId, { until: 0, pending });
	try {
		await pending;
		subscriptions.set(ownerId, { until: Date.now() + 300000 });
	} catch (error) {
		subscriptions.delete(ownerId);
		throw error;
	}
}
const catalogs = new Map<string, { until: number; value: AwardChatCatalog }>();
export async function connectAwardChat(id: string, secret: string, preview = false) {
	try {
		const { ownerId } = await authorizeAwardChat(id, secret, preview);
		if (!activateAwardChat(ownerId)) throw new EventError("SERVICE_UNAVAILABLE");
		const token = await getAppAccessToken();
		if (!token) throw new EventError("PROVIDER_UNAVAILABLE");
		const headers = { Authorization: `Bearer ${token.access_token}`, "Client-Id": process.env.TWITCH_CLIENT_ID ?? "" };
		await subscribe(ownerId, headers);
		const cached = catalogs.get(ownerId);
		if (cached && cached.until > Date.now()) return { ok: true as const, catalog: cached.value };
		const responses = await Promise.allSettled([providerJson("https://api.twitch.tv/helix/chat/badges/global", headers), providerJson(`https://api.twitch.tv/helix/chat/badges?broadcaster_id=${encodeURIComponent(ownerId)}`, headers), providerJson("https://7tv.io/v3/emote-sets/global"), providerJson(`https://7tv.io/v3/users/twitch/${encodeURIComponent(ownerId)}`)]);
		const values = responses.map((response) => (response.status === "fulfilled" ? response.value : null)),
			user = values[3] as { emote_set?: unknown } | null;
		const catalog = parseAwardChatCatalog(values.slice(0, 2), [values[2], user?.emote_set]);
		if (responses.slice(0, 2).some((response) => response.status === "rejected")) catalog.warnings.push("Twitch badges are temporarily unavailable.");
		if (responses[2].status === "rejected") catalog.warnings.push("7TV emotes are temporarily unavailable.");
		for (const [key, value] of catalogs) if (value.until < Date.now()) catalogs.delete(key);
		if (catalogs.size < 100) catalogs.set(ownerId, { until: Date.now() + 300000, value: catalog });
		return { ok: true as const, catalog };
	} catch (error) {
		return eventError(error);
	}
}
const userBadges = new Map<string, { until: number; value: Promise<AwardChatBadge | null> }>();
export async function enrichChatBadges(messages: AwardChatMessage[]): Promise<AwardChatMessage[]> {
	for (const [id, entry] of userBadges) if (entry.until <= Date.now()) userBadges.delete(id);
	const ids = [...new Set(messages.flatMap((message) => (message.userId ? [message.userId] : [])))];
	// Bound new lookups per snapshot; cached viewers leave room for the next uncached viewers.
	for (const id of ids.filter((id) => !userBadges.has(id)).slice(0, 10)) {
		if (userBadges.size >= 1000) userBadges.delete(userBadges.keys().next().value!);
		const value = providerJson(
			"https://7tv.io/v4/gql",
			{ "Content-Type": "application/json" },
			{
				query: "query AwardChatBadge($id: String!) { users { userByConnection(platform: TWITCH, platformId: $id) { style { activeBadge { id name images { url scale mime } } } } } }",
				variables: { id },
			},
			1500,
		)
			.then(parseAwardChatBadge)
			.catch(() => null);
		userBadges.set(id, { until: Date.now() + 60000, value });
	}
	const badges = new Map(await Promise.all(ids.filter((id) => userBadges.has(id)).map(async (id) => [id, await userBadges.get(id)!.value] as const)));
	return messages.map((message) => ({ ...message, sevenTvBadge: badges.get(message.userId ?? "") ?? undefined }));
}
export async function pollAwardChat(id: string, secret: string) {
	try {
		const { ownerId, settings } = await authorizeAwardChat(id, secret);
		if (!activateAwardChat(ownerId)) throw new EventError("SERVICE_UNAVAILABLE");
		return { ok: true as const, messages: await enrichChatBadges(filterAwardChat(readAwardChat(ownerId), settings)) };
	} catch (error) {
		return eventError(error);
	}
}
