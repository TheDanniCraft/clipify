import type { MetadataRoute } from "next";
import { getBaseUrl } from "@actions/utils";

const baseUrl = await getBaseUrl();

export default function sitemap(): MetadataRoute.Sitemap {
	return [
		{
			url: baseUrl.toString(),
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 1,
		},
		{
			url: `${baseUrl}changelog`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.8,
		},

		{
			url: `${baseUrl}login`,
			lastModified: new Date(),
			changeFrequency: "yearly",
			priority: 0.7,
		},
		{
			url: `${baseUrl}roadmap`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.7,
		},
		{
			url: `${baseUrl}referral-program`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.7,
		},
		{
			url: `${baseUrl}llms.txt`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.7,
		},
		{
			url: "https://help.clipify.us/",
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.5,
		},
	];
}
