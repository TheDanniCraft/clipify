import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: "*",
			allow: "/",
			disallow: ["/dashboard", "/eventsub", "/proxy"],
		},
		sitemap: "https://clipify.us/sitemap.xml",
	};
}
