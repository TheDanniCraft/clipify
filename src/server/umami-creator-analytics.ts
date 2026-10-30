import "server-only";
import { resolveBaseUrl } from "@/app/lib/baseUrl";
import type { CreatorAnalyticsData, CreatorAnalyticsMetrics, CreatorAnalyticsBreakdownItem } from "@/app/lib/plausibleCreatorAnalytics";
import { queryUmami } from "./umami";

type Stats = { pageviews: number; visitors: number; visits: number; bounces: number; totaltime: number };
type NumericPoint = { t: string; y: number | string };
type EventStats = { data: { events: number; visits: number } };
const number = (value: unknown) => {
	if (value === null || value === undefined || !Number.isFinite(Number(value))) throw new Error("Invalid Umami metric");
	return Number(value);
};
const dateOf = (value: string) => value.slice(0, 10);
const dailyTotals = (rows: NumericPoint[]) => new Map(rows.map((row) => [dateOf(row.t), number(row.y)]));

function metrics(stats: Stats, activeMs: number, depth: number, plays: number, playVisits: number): CreatorAnalyticsMetrics {
	const pageviews = number(stats.pageviews);
	const visits = number(stats.visits);
	return { visitors: number(stats.visitors), pageviews, visits, bounceRate: visits ? (number(stats.bounces) / visits) * 100 : 0, timeOnPage: pageviews ? activeMs / pageviews / 1000 : 0, scrollDepth: pageviews ? Math.min(100, depth / pageviews) : 0, clipPlays: plays, playsPerVisit: visits ? plays / visits : 0, playRate: visits ? Math.min(100, (playVisits / visits) * 100) : 0 };
}

export async function getUmamiCreatorAnalytics(username: string, range: { start: string; end: string }): Promise<CreatorAnalyticsData> {
	const startAt = Date.parse(`${range.start}T00:00:00Z`);
	const endAt = Date.parse(`${range.end}T23:59:59.999Z`);
	const parameters = { startAt, endAt, timezone: "UTC", url: `eq./creators/${username}`, hostname: `eq.${resolveBaseUrl().hostname}` };
	const read = <T>(endpoint: string, extra: Record<string, string | number> = {}) => queryUmami<T>(endpoint, { ...parameters, ...extra });
	const properties = { eventName: "page_engagement" };
	const dimensions = { sources: "referrer", channels: "channel", utmSources: "utmSource", mediums: "utmMedium", campaigns: "utmCampaign", countries: "country", regions: "region", cities: "city", devices: "device", browsers: "browser", operatingSystems: "os" } as const;
	const [stats, traffic, active, scroll, activeSeries, scrollSeries, playback, playbackSeries, breakdownRows] = await Promise.all([
		read<Stats>("/stats"),
		read<{ pageviews: { x: string; y: number }[] }>("/pageviews", { unit: "day" }),
		read<{ total: number | string }>("/event-data-pivot/numeric-stats", { ...properties, propertyName: "active_ms" }),
		read<{ total: number | string }>("/event-data-pivot/numeric-stats", { ...properties, propertyName: "scroll_increment" }),
		read<NumericPoint[]>("/event-data-pivot/numeric-series", { ...properties, propertyName: "active_ms", metric: "sum", unit: "day" }),
		read<NumericPoint[]>("/event-data-pivot/numeric-series", { ...properties, propertyName: "scroll_increment", metric: "sum", unit: "day" }),
		read<EventStats>("/events/stats", { event: "eq.clip_played" }),
		read<{ x: string; t: string; y: number }[]>("/events/series", { event: "eq.clip_played", unit: "day" }),
		Promise.all(Object.entries(dimensions).map(async ([key, type]) => [key, await read<{ name: string; visits: number }[]>("/metrics/expanded", { type, limit: 500 })] as const)),
	]);
	const overview = metrics(stats, number(active.total), number(scroll.total), number(playback.data.events), number(playback.data.visits));
	const activeDays = dailyTotals(activeSeries);
	const scrollDays = dailyTotals(scrollSeries);
	const playDays = new Map(playbackSeries.filter((point) => point.x === "clip_played").map((point) => [dateOf(point.t), number(point.y)]));
	const days = [...new Set(traffic.pageviews.filter((point) => number(point.y) > 0).map((point) => dateOf(point.x)))].sort();
	const timeseries: CreatorAnalyticsData["timeseries"] = [];
	let next = 0;
	// Native stats provides real visitors/visits/bounces; cap concurrent date requests rather than inventing daily metrics.
	await Promise.all(
		Array.from({ length: Math.min(4, days.length) }, async () => {
			while (next < days.length) {
				const date = days[next++];
				const start = Date.parse(`${date}T00:00:00Z`);
				const end = Date.parse(`${date}T23:59:59.999Z`);
				const [daily, played] = await Promise.all([read<Stats>("/stats", { startAt: start, endAt: end }), playDays.has(date) ? read<EventStats>("/events/stats", { startAt: start, endAt: end, event: "eq.clip_played" }) : Promise.resolve({ data: { events: 0, visits: 0 } })]);
				timeseries.push({ date, ...metrics(daily, activeDays.get(date) ?? 0, scrollDays.get(date) ?? 0, number(played.data.events), number(played.data.visits)) });
			}
		}),
	);
	timeseries.sort((a, b) => a.date.localeCompare(b.date));
	const breakdowns = Object.fromEntries(
		breakdownRows.map(([key, rows]) => [
			key,
			rows.map((row): CreatorAnalyticsBreakdownItem => {
				const visits = number(row.visits);
				let name = row.name || (key === "sources" ? "Direct / None" : "Unknown");
				if (key === "countries" && /^[A-Z]{2}$/.test(name)) name = new Intl.DisplayNames(["en"], { type: "region" }).of(name) ?? name;
				return { name, visits, percentage: overview.visits ? (visits / overview.visits) * 100 : 0 };
			}),
		]),
	) as CreatorAnalyticsData["breakdowns"];
	return { metrics: overview, timeseries, breakdowns };
}
