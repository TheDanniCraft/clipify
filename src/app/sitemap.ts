import { publicGuides } from "@lib/publicGuides";
import type { MetadataRoute } from "next";
import { getBaseUrl } from "@actions/utils";
import { db } from "@/db/client";
import { settingsTable, usersTable } from "@/db/schema";
import { and, eq, isNull, or } from "drizzle-orm";

const baseUrl = await getBaseUrl();

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const creators = await db
		.select({ username: usersTable.username, updatedAt: usersTable.updatedAt })
		.from(usersTable)
		.innerJoin(settingsTable, eq(settingsTable.id, usersTable.id))
		.where(and(eq(usersTable.disabled, false), eq(settingsTable.creatorPageEnabled, true), or(eq(settingsTable.creatorPageVisibility, "discoverable"), and(isNull(settingsTable.creatorPageVisibility), eq(settingsTable.showOnCommunityPage, true)))))
		.execute();

	return [
		{
			url: baseUrl.toString(),
			changeFrequency: "monthly",
			priority: 1,
		},
		{
			url: `${baseUrl}changelog`,
			changeFrequency: "weekly",
			priority: 0.8,
		},
		{
			url: `${baseUrl}pricing`,
			changeFrequency: "monthly",
			priority: 0.9,
		},

		{
			url: `${baseUrl}roadmap`,
			changeFrequency: "monthly",
			priority: 0.7,
		},
		{ url: `${baseUrl}community`, changeFrequency: "weekly", priority: 0.7 },
		{ url: `${baseUrl}gallery`, changeFrequency: "monthly", priority: 0.6 },
		{ url: `${baseUrl}features`, changeFrequency: "monthly", priority: 0.8 },
		...publicGuides.map((guide) => ({ url: `${baseUrl}guides/${guide.slug}`, changeFrequency: "monthly" as const, priority: 0.7 })),
		...creators.map((creator) => ({
			url: new URL(`/creators/${encodeURIComponent(creator.username.toLowerCase())}`, baseUrl).toString(),
			...(creator.updatedAt ? { lastModified: creator.updatedAt } : {}),
			changeFrequency: "daily" as const,
			priority: 0.7,
		})),
	];
}
