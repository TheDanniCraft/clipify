"use server";

import { db } from "@/db/client";
import { settingsTable, usersTable } from "@/db/schema";
import { getCachedClipsByOwner, getCreatorTwitchDetails, getTwitchClipPlaybackUrl } from "@actions/twitch";
import { queryCreatorClips, resolveCreatorPageVisibility, type CreatorClipQuery } from "@lib/creatorPage";
import { resolveUserEntitlements } from "@lib/entitlements";
import { getFeatureAccess } from "@lib/featureAccess";
import { eq, sql } from "drizzle-orm";

async function getCreator(username: string) {
	const rows = await db
		.select({ user: usersTable, settings: settingsTable })
		.from(usersTable)
		.leftJoin(settingsTable, eq(settingsTable.id, usersTable.id))
		.where(sql`lower(${usersTable.username}) = lower(${username})`)
		.limit(1)
		.execute();
	const row = rows[0];
	if (!row || row.user.disabled || row.settings?.creatorPageEnabled === false) return null;
	const visibility = resolveCreatorPageVisibility(row.settings ?? { showOnCommunityPage: false }) as "discoverable" | "unlisted";
	return { ...row, visibility, entitlements: await resolveUserEntitlements(row.user) };
}

export async function getCreatorPage(username: string, query: CreatorClipQuery = {}) {
	const creator = await getCreator(username);
	if (!creator) return null;
	const [twitch, clips] = await Promise.all([getCreatorTwitchDetails(creator.user.username, creator.user.id), getCachedClipsByOwner(creator.user.id)]);
	const page = queryCreatorClips(clips, query);
	const twitchBadge = twitch.profile?.broadcaster_type === "partner" ? "Twitch Partner" : twitch.profile?.broadcaster_type === "affiliate" ? "Twitch Affiliate" : null;
	const clipifyBadge = creator.entitlements.grantSource === "partner" ? "Clipify Partner" : creator.entitlements.effectivePlan === "pro" ? "Clipify Pro" : "Clipify Creator";
	const socialPreviewAccess = getFeatureAccess({ ...creator.user, entitlements: creator.entitlements }, "creator_page_social_preview").allowed;
	return {
		creator: {
			id: creator.user.id,
			username: creator.user.username,
			avatar: twitch.profile?.profile_image_url || creator.user.avatar,
			description: creator.settings?.creatorPageShowBio === false ? "" : twitch.profile?.description || "",
			createdAt: creator.user.createdAt,
			visibility: creator.visibility,
			twitchBadge,
			clipifyBadge,
			live: twitch.live,
			socialTitle: socialPreviewAccess ? (creator.settings?.creatorPageSocialTitle ?? null) : null,
			socialDescription: socialPreviewAccess ? (creator.settings?.creatorPageSocialDescription ?? null) : null,
		},
		...page,
	};
}

export async function getCreatorClipPage(username: string, query: CreatorClipQuery) {
	const creator = await getCreator(username);
	if (!creator) return null;
	return queryCreatorClips(await getCachedClipsByOwner(creator.user.id), query);
}

export async function getCreatorClipPlayback(username: string, clipId: string) {
	const creator = await getCreator(username);
	if (!creator) return null;
	const clip = (await getCachedClipsByOwner(creator.user.id)).find((entry) => entry.id === clipId);
	if (!clip) return null;
	let playbackUrl: string | null = null;
	try {
		playbackUrl = (await getTwitchClipPlaybackUrl(clip.id, clip.broadcaster_id)) ?? null;
	} catch {
		playbackUrl = null;
	}
	return { clip, playbackUrl };
}
