/** @jest-environment node */

import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Content Security Policy", () => {
	it("allows the consent-gated Chatwoot iframe", () => {
		const nextConfig = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");

		expect(nextConfig).toContain("frame-src 'self' https://challenges.cloudflare.com https://chat.cloud.thedannicraft.de");
	});
});
