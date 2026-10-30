/** @jest-environment node */
import config from "../../next.config";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
jest.mock("@vercel/nft", () => ({ nodeFileTrace: jest.fn().mockResolvedValue({ fileList: [] }) }));
jest.mock("@sentry/nextjs/config", () => ({ withSentryConfig: (value: unknown) => value }));

it("proxies only native public collection, recorder configuration and randomized script paths", async () => {
	const resolved = await config;
	const rewrites = await resolved.rewrites!();
	expect(Array.isArray(rewrites)).toBe(true);
	if (!Array.isArray(rewrites)) throw new Error("Expected exact rewrites");
	expect(rewrites.filter((row) => row.source.startsWith("/statistics/")).map((row) => row.destination)).toEqual(["https://umami.cloud.thedannicraft.de/api/send", "https://umami.cloud.thedannicraft.de/api/record", "https://umami.cloud.thedannicraft.de/api/websites/:websiteId/recorder"]);
	expect(rewrites.filter((row) => row.source.startsWith("/js/")).every((row) => /^\/js\/bundle_[a-f0-9]{16}\.js$/.test(row.source))).toBe(true);
});

it("allows the Umami dashboard to frame only approved public heatmap pages", async () => {
	const resolved = await config;
	const rules = await resolved.headers!();
	function headersFor(path: string) {
		return Object.fromEntries(rules.filter((row) => getPathMatch(row.source)(path)).flatMap((row) => row.headers.map((header) => [header.key, header.value])));
	}
	for (const path of ["/", "/features", "/pricing"]) {
		expect(headersFor(path)["Content-Security-Policy"]).toContain("frame-ancestors https://umami.cloud.thedannicraft.de;");
		expect(headersFor(path)["X-Frame-Options"]).toBeUndefined();
	}
	for (const path of ["/dashboard", "/dashboard/overlay/private", "/login", "/auth", "/legal/privacy"]) {
		expect(headersFor(path)["Content-Security-Policy"]).toContain("frame-ancestors 'none';");
		expect(headersFor(path)["X-Frame-Options"]).toBe("DENY");
	}
	expect(headersFor("/demoPlayer")["Content-Security-Policy"]).toContain("frame-ancestors 'self';");
});
