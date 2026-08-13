import { createCreatorAnalyticsCsv, createEmptyCreatorAnalytics, fillEmptyCreatorAnalyticsRange, getCreatorAnalyticsRuntimeMetrics, parsePlausibleCreatorAnalytics, parsePlausibleCreatorMetrics, recordCreatorAnalyticsMetric } from "@lib/plausibleCreatorAnalytics";

describe("plausibleCreatorAnalytics", () => {
	beforeEach(() => {
		globalThis.__creatorAnalyticsMetrics = undefined;
	});

	it("parses the Plausible aggregate metric order", () => {
		expect(parsePlausibleCreatorMetrics({ results: [{ metrics: [12, 34, 10, 42.5, 91.2, 64] }] })).toEqual({
			visitors: 12,
			pageviews: 34,
			visits: 10,
			bounceRate: 42.5,
			timeOnPage: 91.2,
			scrollDepth: 64,
			clipPlays: 0,
			playsPerVisit: 0,
			playRate: 0,
		});
	});

	it("returns safe zeroes for missing or invalid metrics", () => {
		expect(parsePlausibleCreatorMetrics({ results: [{ metrics: [null, "invalid"] }] })).toEqual({ visitors: 0, pageviews: 0, visits: 0, bounceRate: 0, timeOnPage: 0, scrollDepth: 0, clipPlays: 0, playsPerVisit: 0, playRate: 0 });
	});

	it("uses the metric names stored in legacy Plausible payloads", () => {
		expect(
			parsePlausibleCreatorMetrics({
				results: [{ metrics: [12, 34, 10, 42.5, 91.2] }],
				query: { metrics: ["visitors", "pageviews", "visits", "bounce_rate", "visit_duration"] },
			}),
		).toEqual({ visitors: 12, pageviews: 34, visits: 10, bounceRate: 42.5, timeOnPage: 0, scrollDepth: 0, clipPlays: 0, playsPerVisit: 0, playRate: 0 });
	});

	it("parses timeseries and aggregates multi-dimensional breakdowns", () => {
		const analytics = parsePlausibleCreatorAnalytics({
			overview: { results: [{ metrics: [12, 34, 10, 42.5, 91.2, 64] }] },
			timeseries: { results: [{ dimensions: ["2026-08-08"], metrics: [4, 8, 3, 40, 80, 55] }] },
			acquisition: {
				results: [
					{ dimensions: ["Twitch", "Social", "panel", "social", "creator-page"], metrics: [6] },
					{ dimensions: ["Twitch", "Social", "bio", "social", "creator-page"], metrics: [2] },
				],
			},
			locations: { results: [{ dimensions: ["Germany", "Berlin", "Berlin"], metrics: [5] }] },
			technology: { results: [{ dimensions: ["Desktop", "Chrome", "Windows"], metrics: [7] }] },
		});
		expect(analytics.timeseries[0]).toEqual({ date: "2026-08-08", visitors: 4, pageviews: 8, visits: 3, bounceRate: 40, timeOnPage: 80, scrollDepth: 55, clipPlays: 0, playsPerVisit: 0, playRate: 0 });
		expect(analytics.breakdowns.sources[0]).toMatchObject({ name: "Twitch", visits: 8, percentage: 80 });
		expect(analytics.breakdowns.cities[0]).toMatchObject({ name: "Berlin, Berlin, Germany", visits: 5 });
		expect(analytics.breakdowns.devices[0]).toMatchObject({ name: "Desktop", visits: 7 });
	});

	it("fills Plausible time labels that have no result row with zeroes", () => {
		const analytics = parsePlausibleCreatorAnalytics({
			overview: { results: [{ metrics: [4, 8, 3, 40, 80, 55] }] },
			timeseries: {
				meta: { time_labels: ["2026-08-07", "2026-08-08"] },
				results: [{ dimensions: ["2026-08-08"], metrics: [4, 8, 3, 40, 80, 55] }],
			},
		});
		expect(analytics.timeseries).toEqual([
			{ date: "2026-08-07", visitors: 0, pageviews: 0, visits: 0, bounceRate: 0, timeOnPage: 0, scrollDepth: 0, clipPlays: 0, playsPerVisit: 0, playRate: 0 },
			{ date: "2026-08-08", visitors: 4, pageviews: 8, visits: 3, bounceRate: 40, timeOnPage: 80, scrollDepth: 55, clipPlays: 0, playsPerVisit: 0, playRate: 0 },
		]);
	});

	it("derives clip plays, plays per visit, and playback rate from playback events", () => {
		const analytics = parsePlausibleCreatorAnalytics({
			overview: { results: [{ metrics: [8, 18, 10, 30, 60, 70] }] },
			timeseries: {
				query: { metrics: ["visitors", "pageviews", "visits", "bounce_rate", "time_on_page", "scroll_depth"] },
				results: [{ dimensions: ["2026-08-08"], metrics: [4, 9, 5, 20, 50, 60] }],
			},
			playbackOverview: { query: { metrics: ["events", "visits"] }, results: [{ metrics: [15, 6] }] },
			playbackTimeseries: { query: { metrics: ["events", "visits"] }, results: [{ dimensions: ["2026-08-08"], metrics: [8, 3] }] },
		});

		expect(analytics.metrics).toMatchObject({ clipPlays: 15, playsPerVisit: 1.5, playRate: 60 });
		expect(analytics.timeseries[0]).toMatchObject({ clipPlays: 8, playsPerVisit: 1.6, playRate: 60 });
	});

	it("creates a continuous zero-valued series when no analytics rows are available", () => {
		const analytics = createEmptyCreatorAnalytics("2026-08-07", "2026-08-09");
		expect(analytics.metrics).toEqual({ visitors: 0, pageviews: 0, visits: 0, bounceRate: 0, timeOnPage: 0, scrollDepth: 0, clipPlays: 0, playsPerVisit: 0, playRate: 0 });
		expect(analytics.timeseries.map((point) => [point.date, point.visitors])).toEqual([
			["2026-08-07", 0],
			["2026-08-08", 0],
			["2026-08-09", 0],
		]);
	});

	it("fills a successful empty response without replacing real time-series data", () => {
		const empty = fillEmptyCreatorAnalyticsRange(parsePlausibleCreatorAnalytics({}), "2026-08-07", "2026-08-08");
		expect(empty.timeseries.map((point) => point.date)).toEqual(["2026-08-07", "2026-08-08"]);

		const populated = parsePlausibleCreatorAnalytics({ timeseries: { results: [{ dimensions: ["2026-08-08"], metrics: [1, 2, 1, 2, 0, 5] }] } });
		expect(fillEmptyCreatorAnalyticsRange(populated, "2026-08-07", "2026-08-08")).toBe(populated);
	});

	it("creates BOM-free UTF-8 CSV and neutralizes spreadsheet formulas", () => {
		const analytics = parsePlausibleCreatorAnalytics({
			overview: { results: [{ metrics: [1, 2, 1, 2, 0, 5] }] },
			timeseries: { results: [{ dimensions: ["2026-08-08"], metrics: [1, 2, 1, 2, 0, 5] }] },
			acquisition: { results: [{ dimensions: ['=HYPERLINK("bad")', "Social", "", "", ""], metrics: [1] }] },
		});
		const daily = createCreatorAnalyticsCsv(analytics, "daily");
		const acquisition = createCreatorAnalyticsCsv(analytics, "acquisition");
		expect(daily.charCodeAt(0)).not.toBe(0xfeff);
		expect(daily).toContain("2026-08-08,1,1,2,2,0,5");
		expect(acquisition).toContain('"\'=HYPERLINK(""bad"")"');
	});

	it("derives cache hit rate and API latency without exposing traffic data", () => {
		recordCreatorAnalyticsMetric("hits");
		recordCreatorAnalyticsMetric("misses");
		recordCreatorAnalyticsMetric("apiRequests", 80);
		expect(getCreatorAnalyticsRuntimeMetrics()).toMatchObject({ hitRate: 0.5, averageLatencyMs: 80, apiRequests: 1 });
	});
});
