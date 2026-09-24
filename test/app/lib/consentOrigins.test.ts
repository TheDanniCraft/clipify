/** @jest-environment node */

import { getConsentTrustedOrigins } from "@lib/consent/origins";

describe("consent trusted origins", () => {
	it("trusts the normalized Coolify preview origin", () => {
		const origins = getConsentTrustedOrigins({
			NODE_ENV: "production",
			COOLIFY_URL: "https://beta-472.clipify.cloud.thedannicraft.de/some/path",
		});

		expect(origins).toContain("https://beta-472.clipify.cloud.thedannicraft.de");
	});

	it("uses the first hostname from a scheme-less Coolify URL list", () => {
		const origins = getConsentTrustedOrigins({
			NODE_ENV: "production",
			COOLIFY_URL: "beta-472.clipify.cloud.thedannicraft.de, fallback.example.com",
		});

		expect(origins).toContain("https://beta-472.clipify.cloud.thedannicraft.de");
		expect(origins).not.toContain("https://fallback.example.com");
	});

	it("retains the configured public base URL and stable origins", () => {
		const origins = getConsentTrustedOrigins({
			NODE_ENV: "production",
			NEXT_PUBLIC_BASE_URL: "dashboard.clipify.us/path",
		});

		expect(origins).toEqual(expect.arrayContaining(["https://clipify.us", "https://www.clipify.us", "http://localhost:3000", "https://dashboard.clipify.us"]));
	});
});
