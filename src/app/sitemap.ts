import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
	return [
		{
			url: "https://clipify.us/",
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 1,
		},
		{
			url: "https://clipify.us/login",
			lastModified: new Date(),
			changeFrequency: "yearly",
			priority: 0.7,
		},
		{
			url: "https://chat.cloud.thedannicraft.de/hc/clipify/en",
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.5,
		},
	];
}
