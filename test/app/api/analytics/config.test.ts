/** @jest-environment node */
import { GET, dynamic } from "@/app/api/analytics/config/route";

it("reads Infisical's one website ID at request time with no production fallback or caching", async () => {
	const previous = process.env.UMAMI_WEBSITE_ID;
	try {
		for (const websiteId of ["sandbox-site", "production-site"]) {
			process.env.UMAMI_WEBSITE_ID = websiteId;
			const response = GET();
			expect(await response.json()).toEqual({ websiteId });
			expect(response.headers.get("Cache-Control")).toBe("no-store");
		}
		delete process.env.UMAMI_WEBSITE_ID;
		expect(await GET().json()).toEqual({ websiteId: "" });
		expect(dynamic).toBe("force-dynamic");
	} finally {
		if (previous === undefined) delete process.env.UMAMI_WEBSITE_ID;
		else process.env.UMAMI_WEBSITE_ID = previous;
	}
});
