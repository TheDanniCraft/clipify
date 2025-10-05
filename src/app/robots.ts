import type { MetadataRoute } from "next";
import { getBaseUrl } from "@actions/utils";

const baseUrl = await getBaseUrl();
const sitemapUrl = new URL("/sitemap.xml", baseUrl).toString();

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: "*",
			allow: ["/", "/llms.txt"],
			disallow: ["/dashboard", "/eventsub", "/proxy", "/overlay"],
		},
		sitemap: sitemapUrl,
	};
}
