import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: "*",
			allow: ["/", "/llms.txt"],
			disallow: ["/dashboard", "/eventsub", "/proxy", "/overlay"],
		},
		sitemap: "https://clipify.us/sitemap.xml",
	};
}
