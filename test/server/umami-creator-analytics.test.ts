/** @jest-environment node */
import { getUmamiCreatorAnalytics } from "@/server/umami-creator-analytics";
const query = jest.fn();
jest.mock("@/server/umami", () => ({ queryUmami: (...args: unknown[]) => query(...args) }));

beforeEach(() => {
	process.env.NEXT_PUBLIC_BASE_URL = "https://clipify.us";
	query.mockImplementation(async (endpoint: string, params: Record<string, string>) => {
		if (endpoint === "/stats") return { pageviews: 10, visitors: 4, visits: 5, bounces: 2, totaltime: 200 };
		if (endpoint === "/pageviews") return { pageviews: [{ x: "2026-10-01", y: 10 }], sessions: [{ x: "2026-10-01", y: 5 }] };
		if (endpoint.endsWith("numeric-stats")) return { total: params.propertyName === "active_ms" ? "60000" : "700" };
		if (endpoint.endsWith("numeric-series")) return [{ t: "2026-10-01", y: params.propertyName === "active_ms" ? "60000" : "700" }];
		if (endpoint === "/events/stats") return { data: { events: 4, visits: 2 } };
		if (endpoint === "/events/series") return [{ x: "clip_played", t: "2026-10-01", y: 4 }];
		if (endpoint === "/metrics/expanded") return params.type === "browser" ? [{ name: "Safari", visits: 3 }] : [];
		throw new Error("Unexpected endpoint");
	});
});
it("preserves real visitors/visits and engagement metrics instead of substituting visit duration", async () => {
	const data = await getUmamiCreatorAnalytics("家姐", { start: "2026-10-01", end: "2026-10-02" });
	expect(data.metrics).toMatchObject({ visitors: 4, visits: 5, pageviews: 10, bounceRate: 40, timeOnPage: 6, scrollDepth: 70, clipPlays: 4, playsPerVisit: 0.8, playRate: 40 });
	expect(data.timeseries[0]).toMatchObject({ date: "2026-10-01", visitors: 4, visits: 5, timeOnPage: 6, scrollDepth: 70 });
	expect(data.breakdowns.browsers).toEqual([{ name: "Safari", visits: 3, percentage: 60 }]);
	for (const [, params] of query.mock.calls) expect(params).toMatchObject({ url: "eq./creators/家姐", hostname: "eq.clipify.us" });
});
it("does not turn invalid native metrics into plausible-looking zero reports", async () => {
	query.mockResolvedValue({ error: "invalid" });
	await expect(getUmamiCreatorAnalytics("creator", { start: "2026-10-01", end: "2026-10-02" })).rejects.toThrow();
});

it("filters preview reports by the actual hostname", async () => {
	process.env.NEXT_PUBLIC_BASE_URL = "https://beta-533.clipify.cloud.thedannicraft.de";
	query.mockClear();
	await getUmamiCreatorAnalytics("creator", { start: "2026-10-01", end: "2026-10-02" });
	for (const [, params] of query.mock.calls) expect(params.hostname).toBe("eq.beta-533.clipify.cloud.thedannicraft.de");
});
