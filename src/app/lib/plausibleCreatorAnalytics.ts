export type CreatorAnalyticsMetrics = {
	visitors: number;
	pageviews: number;
	visits: number;
	bounceRate: number;
	timeOnPage: number;
	scrollDepth: number;
};

export type CreatorAnalyticsTimeseriesPoint = CreatorAnalyticsMetrics & { date: string };
export type CreatorAnalyticsBreakdownItem = { name: string; visits: number; percentage: number };

export type CreatorAnalyticsData = {
	metrics: CreatorAnalyticsMetrics;
	timeseries: CreatorAnalyticsTimeseriesPoint[];
	breakdowns: {
		sources: CreatorAnalyticsBreakdownItem[];
		channels: CreatorAnalyticsBreakdownItem[];
		utmSources: CreatorAnalyticsBreakdownItem[];
		mediums: CreatorAnalyticsBreakdownItem[];
		campaigns: CreatorAnalyticsBreakdownItem[];
		countries: CreatorAnalyticsBreakdownItem[];
		regions: CreatorAnalyticsBreakdownItem[];
		cities: CreatorAnalyticsBreakdownItem[];
		devices: CreatorAnalyticsBreakdownItem[];
		browsers: CreatorAnalyticsBreakdownItem[];
		operatingSystems: CreatorAnalyticsBreakdownItem[];
	};
};

export type PlausibleCreatorPayload = {
	overview?: unknown;
	timeseries?: unknown;
	acquisition?: unknown;
	locations?: unknown;
	technology?: unknown;
};

export type CreatorAnalyticsExportDataset = "daily" | "acquisition" | "locations" | "technology";

type PlausibleRow = { dimensions?: unknown[]; metrics?: unknown[] };
type PlausibleResponse = { results?: PlausibleRow[]; meta?: { time_labels?: unknown[] }; query?: { metrics?: unknown[] } };

type AnalyticsRuntimeMetrics = { hits: number; misses: number; apiRequests: number; apiFailures: number; rateLimited: number; staleFallbacks: number; totalLatencyMs: number; lastFetchAt: string | null };

declare global {
	var __creatorAnalyticsMetrics: AnalyticsRuntimeMetrics | undefined;
}

function store(): AnalyticsRuntimeMetrics {
	return (globalThis.__creatorAnalyticsMetrics ??= { hits: 0, misses: 0, apiRequests: 0, apiFailures: 0, rateLimited: 0, staleFallbacks: 0, totalLatencyMs: 0, lastFetchAt: null });
}

function number(value: unknown) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function rows(payload: unknown): PlausibleRow[] {
	return Array.isArray((payload as PlausibleResponse | null)?.results) ? ((payload as PlausibleResponse).results ?? []) : [];
}

function timeLabels(payload: unknown) {
	const labels = (payload as PlausibleResponse | null)?.meta?.time_labels;
	return Array.isArray(labels) ? labels.filter((label): label is string => typeof label === "string" && label.length > 0) : [];
}

const CURRENT_METRIC_ORDER = ["visitors", "pageviews", "visits", "bounce_rate", "time_on_page", "scroll_depth"] as const;

function metricsFromRow(row: PlausibleRow | undefined, metricNames: readonly unknown[] = CURRENT_METRIC_ORDER): CreatorAnalyticsMetrics {
	const metrics = row?.metrics ?? [];
	const value = (name: (typeof CURRENT_METRIC_ORDER)[number]) => {
		const index = metricNames.indexOf(name);
		return index >= 0 ? number(metrics[index]) : 0;
	};
	return { visitors: value("visitors"), pageviews: value("pageviews"), visits: value("visits"), bounceRate: value("bounce_rate"), timeOnPage: value("time_on_page"), scrollDepth: value("scroll_depth") };
}

function responseMetricNames(payload: unknown) {
	const names = (payload as PlausibleResponse | null)?.query?.metrics;
	return Array.isArray(names) && names.length > 0 ? names : CURRENT_METRIC_ORDER;
}

function dimension(row: PlausibleRow, index: number) {
	const value = row.dimensions?.[index];
	return typeof value === "string" ? value.trim() : "";
}

function breakdown(payload: unknown, dimensionIndex: number, totalVisits: number, label?: (row: PlausibleRow) => string) {
	const totals = new Map<string, number>();
	for (const row of rows(payload)) {
		const name = (label?.(row) ?? dimension(row, dimensionIndex)) || "Direct / None";
		totals.set(name, (totals.get(name) ?? 0) + number(row.metrics?.[0]));
	}
	return [...totals.entries()].map(([name, visits]) => ({ name, visits, percentage: totalVisits > 0 ? Math.min(100, (visits / totalVisits) * 100) : 0 })).sort((a, b) => b.visits - a.visits);
}

function joinedLocation(row: PlausibleRow, indices: number[]) {
	return indices
		.map((index) => dimension(row, index))
		.filter(Boolean)
		.join(", ");
}

export function recordCreatorAnalyticsMetric(type: keyof Pick<AnalyticsRuntimeMetrics, "hits" | "misses" | "apiRequests" | "apiFailures" | "rateLimited" | "staleFallbacks">, latencyMs = 0) {
	const metrics = store();
	metrics[type] += 1;
	if (type === "apiRequests") {
		metrics.totalLatencyMs += latencyMs;
		metrics.lastFetchAt = new Date().toISOString();
	}
}

export function getCreatorAnalyticsRuntimeMetrics() {
	const metrics = store();
	return { ...metrics, hitRate: metrics.hits + metrics.misses > 0 ? metrics.hits / (metrics.hits + metrics.misses) : 0, averageLatencyMs: metrics.apiRequests > 0 ? metrics.totalLatencyMs / metrics.apiRequests : 0 };
}

export function parsePlausibleCreatorMetrics(payload: unknown): CreatorAnalyticsMetrics {
	return metricsFromRow(rows(payload)[0], responseMetricNames(payload));
}

export function parsePlausibleCreatorAnalytics(payload: PlausibleCreatorPayload): CreatorAnalyticsData {
	const metrics = parsePlausibleCreatorMetrics(payload.overview);
	const parsedTimeseries = new Map(
		rows(payload.timeseries)
			.map((row) => ({ date: dimension(row, 0), ...metricsFromRow(row, responseMetricNames(payload.timeseries)) }))
			.filter((point) => point.date)
			.map((point) => [point.date, point] as const),
	);
	const labels = timeLabels(payload.timeseries);
	return {
		metrics,
		timeseries: labels.length ? labels.map((date) => parsedTimeseries.get(date) ?? { date, visitors: 0, pageviews: 0, visits: 0, bounceRate: 0, timeOnPage: 0, scrollDepth: 0 }) : [...parsedTimeseries.values()],
		breakdowns: {
			sources: breakdown(payload.acquisition, 0, metrics.visits),
			channels: breakdown(payload.acquisition, 1, metrics.visits),
			utmSources: breakdown(payload.acquisition, 2, metrics.visits),
			mediums: breakdown(payload.acquisition, 3, metrics.visits),
			campaigns: breakdown(payload.acquisition, 4, metrics.visits),
			countries: breakdown(payload.locations, 0, metrics.visits),
			regions: breakdown(payload.locations, 1, metrics.visits, (row) => joinedLocation(row, [1, 0])),
			cities: breakdown(payload.locations, 2, metrics.visits, (row) => joinedLocation(row, [2, 1, 0])),
			devices: breakdown(payload.technology, 0, metrics.visits),
			browsers: breakdown(payload.technology, 1, metrics.visits),
			operatingSystems: breakdown(payload.technology, 2, metrics.visits),
		},
	};
}

export function createEmptyCreatorAnalytics(start: string, end: string): CreatorAnalyticsData {
	const startDate = new Date(`${start}T00:00:00Z`);
	const endDate = new Date(`${end}T00:00:00Z`);
	const labels: string[] = [];
	if (Number.isFinite(startDate.getTime()) && Number.isFinite(endDate.getTime()) && startDate <= endDate) {
		for (let cursor = startDate.getTime(); cursor <= endDate.getTime(); cursor += 86_400_000) labels.push(new Date(cursor).toISOString().slice(0, 10));
	}
	return parsePlausibleCreatorAnalytics({ timeseries: { results: [], meta: { time_labels: labels } } });
}

export function fillEmptyCreatorAnalyticsRange(data: CreatorAnalyticsData, start: string, end: string): CreatorAnalyticsData {
	if (data.timeseries.length > 0) return data;
	return { ...data, timeseries: createEmptyCreatorAnalytics(start, end).timeseries };
}

function protectSpreadsheetFormula(value: string) {
	return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string | number) {
	const safe = protectSpreadsheetFormula(String(value));
	return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function createCreatorAnalyticsCsv(data: CreatorAnalyticsData, dataset: CreatorAnalyticsExportDataset) {
	let rowsToExport: Array<Array<string | number>>;
	if (dataset === "daily") {
		rowsToExport = [["Date", "Unique visitors", "Visits", "Pageviews", "Bounce rate", "Time on page (seconds)", "Scroll depth (percent)"], ...data.timeseries.map((point) => [point.date, point.visitors, point.visits, point.pageviews, point.bounceRate, point.timeOnPage, point.scrollDepth])];
	} else {
		const groups: Array<[string, CreatorAnalyticsBreakdownItem[]]> =
			dataset === "acquisition"
				? [
						["Channels", data.breakdowns.channels],
						["Sources", data.breakdowns.sources],
						["UTM sources", data.breakdowns.utmSources],
						["Campaigns", data.breakdowns.campaigns],
						["Mediums", data.breakdowns.mediums],
					]
				: dataset === "locations"
					? [
							["Countries", data.breakdowns.countries],
							["Regions", data.breakdowns.regions],
							["Cities", data.breakdowns.cities],
						]
					: [
							["Devices", data.breakdowns.devices],
							["Browsers", data.breakdowns.browsers],
							["Operating systems", data.breakdowns.operatingSystems],
						];
		rowsToExport = [["Dimension", "Value", "Visits", "Percentage"], ...groups.flatMap(([dimensionName, items]) => items.map((item) => [dimensionName, item.name, item.visits, item.percentage]))];
	}
	return rowsToExport.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
