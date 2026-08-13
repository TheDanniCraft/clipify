"use client";

import { exportCreatorAnalytics, getCreatorAnalyticsExportTargets, getOwnCreatorAnalytics, type CreatorAnalyticsExportTarget } from "@actions/creatorAnalytics";
import AppDateRangePicker, { type AppDateRange } from "@components/appDateRangePicker";
import type { CreatorAnalyticsBreakdownItem, CreatorAnalyticsExportDataset, CreatorAnalyticsTimeseriesPoint } from "@lib/plausibleCreatorAnalytics";
import { notify } from "@lib/toast";
import { Alert, Button, Card, Description, Label, ListBox, Modal, Select, Spinner, Tabs, useOverlayState } from "@heroui/react";
import { AreaChart } from "@heroui-pro/react/area-chart";
import { ChartTooltip } from "@heroui-pro/react/chart-tooltip";
import { KPI } from "@heroui-pro/react/kpi";
import { IconActivity, IconChartBar, IconChartDots, IconClock, IconDownload, IconEye, IconPercentage, IconPlayerPlay, IconRepeat, IconUsers } from "@tabler/icons-react";
import { getLocalTimeZone, today } from "@internationalized/date";
import { useEffect, useMemo, useState } from "react";

type Data = Awaited<ReturnType<typeof getOwnCreatorAnalytics>>;
type MetricKey = "visitors" | "pageviews" | "visits" | "bounceRate" | "timeOnPage" | "scrollDepth" | "clipPlays" | "playsPerVisit" | "playRate";

const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

function lastDays(days: number): AppDateRange {
	const end = today(getLocalTimeZone());
	return { start: end.subtract({ days: days - 1 }), end };
}

function serializableRange(range: AppDateRange | null) {
	return range ? { start: range.start.toString(), end: range.end.toString() } : null;
}

function metricTrend(points: CreatorAnalyticsTimeseriesPoint[], key: MetricKey, average = false) {
	if (points.length < 2) return { label: "No comparison", trend: "neutral" as const };
	const split = Math.floor(points.length / 2);
	const calculate = (values: number[]) => {
		const total = values.reduce((sum, value) => sum + value, 0);
		return average && values.length ? total / values.length : total;
	};
	const previous = calculate(points.slice(0, split).map((point) => point[key]));
	const current = calculate(points.slice(split).map((point) => point[key]));
	if (previous <= 0) return { label: current > 0 ? "New" : "0%", trend: current > 0 ? ("up" as const) : ("neutral" as const) };
	const change = ((current - previous) / previous) * 100;
	return { label: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`, trend: change > 0 ? ("up" as const) : change < 0 ? ("down" as const) : ("neutral" as const) };
}

function MetricCard({ title, value, valueKey, points, icon, color, suffix, average }: { title: string; value: number; valueKey: MetricKey; points: CreatorAnalyticsTimeseriesPoint[]; icon: React.ReactNode; color: string; suffix?: string; average?: boolean }) {
	const trend = metricTrend(points, valueKey, average);
	const chartData = points.length
		? points.map((point) => ({ label: point.date, value: point[valueKey] }))
		: [
				{ label: "", value: 0 },
				{ label: "", value: 0 },
			];
	return (
		<KPI>
			<KPI.Header>
				<KPI.Icon style={{ color, background: `color-mix(in oklch, ${color} 12%, transparent)` }}>{icon}</KPI.Icon>
				<KPI.Title>{title}</KPI.Title>
			</KPI.Header>
			<KPI.Content>
				<KPI.Value maximumFractionDigits={1} notation={suffix ? "standard" : "compact"} value={value}>
					{suffix ? (formatted) => `${formatted}${suffix}` : undefined}
				</KPI.Value>
				<KPI.Trend trend={trend.trend}>{trend.label}</KPI.Trend>
			</KPI.Content>
			<KPI.Chart
				color={color}
				data={chartData}
				height={72}
				tooltip={
					<AreaChart.Tooltip
						allowEscapeViewBox={{ x: true, y: true }}
						offset={0}
						content={({ active, payload }) => {
							const point = payload?.[0];
							if (!active || !point || !point.payload?.label) return null;
							const metricValue = Number(point.value ?? 0);
							return (
								<div style={{ transform: "translate(-50%, calc(-100% - 10px))" }}>
									<ChartTooltip>
										<ChartTooltip.Header>{dateFormatter.format(new Date(`${String(point.payload.label)}T00:00:00Z`))}</ChartTooltip.Header>
										<ChartTooltip.Item>
											<ChartTooltip.Indicator color={String(point.stroke ?? color)} />
											<ChartTooltip.Label>{title}</ChartTooltip.Label>
											<ChartTooltip.Value>{suffix ? `${metricValue.toLocaleString("en-US", { maximumFractionDigits: 1 })}${suffix}` : compactNumber.format(metricValue)}</ChartTooltip.Value>
										</ChartTooltip.Item>
									</ChartTooltip>
								</div>
							);
						}}
					/>
				}
			/>
		</KPI>
	);
}

function BreakdownExplorer({ label, groups }: { label: string; groups: Array<{ id: string; label: string; items: CreatorAnalyticsBreakdownItem[] }> }) {
	const [selected, setSelected] = useState(groups[0]?.id ?? "");
	const active = groups.find((group) => group.id === selected) ?? groups[0];
	return (
		<Card variant='secondary'>
			<Card.Header className='flex-row items-end justify-between gap-4'>
				<div>
					<p className='font-semibold'>{label}</p>
					<p className='text-xs text-muted'>Visits ranked by the selected dimension.</p>
				</div>
				<Select aria-label={`${label} dimension`} value={active?.id ?? null} onChange={(value) => setSelected(String(value))} className='w-full sm:max-w-56' variant='secondary'>
					<Select.Trigger>
						<Select.Value />
						<Select.Indicator />
					</Select.Trigger>
					<Select.Popover>
						<ListBox>
							{groups.map((group) => (
								<ListBox.Item key={group.id} id={group.id} textValue={group.label}>
									<Label>{group.label}</Label>
									<ListBox.ItemIndicator />
								</ListBox.Item>
							))}
						</ListBox>
					</Select.Popover>
				</Select>
			</Card.Header>
			<Card.Content className='max-h-96 overflow-y-auto pt-0'>
				{active?.items.length ? (
					active.items.map((item, index) => (
						<div key={item.name} className='flex items-center gap-3 border-b border-divider py-3 last:border-0'>
							<span className='w-6 shrink-0 text-right text-xs tabular-nums text-muted'>{index + 1}</span>
							<div className='min-w-0 flex-1'>
								<div className='flex items-center justify-between gap-4 text-sm'>
									<span className='truncate font-medium'>{item.name}</span>
									<span className='shrink-0 tabular-nums text-muted'>{compactNumber.format(item.visits)} visits</span>
								</div>
								<div className='mt-2 h-1.5 overflow-hidden rounded-full bg-default'>
									<div className='h-full rounded-full bg-accent' style={{ width: `${Math.max(item.percentage, 1)}%` }} />
								</div>
							</div>
							<span className='w-14 shrink-0 text-right text-xs tabular-nums text-muted'>{item.percentage.toFixed(1)}%</span>
						</div>
					))
				) : (
					<p className='py-8 text-center text-sm text-muted'>No visits for this dimension in the selected period.</p>
				)}
			</Card.Content>
		</Card>
	);
}

function ExportModal({ isOpen, onOpenChange, range }: { isOpen: boolean; onOpenChange: (open: boolean) => void; range: AppDateRange | null }) {
	const [targets, setTargets] = useState<CreatorAnalyticsExportTarget[]>([]);
	const [ownerId, setOwnerId] = useState("");
	const [datasets, setDatasets] = useState<CreatorAnalyticsExportDataset[]>([]);
	const [exportRange, setExportRange] = useState<AppDateRange | null>(range);
	const [isExporting, setIsExporting] = useState(false);
	useEffect(() => {
		if (isOpen) {
			void getCreatorAnalyticsExportTargets().then((next) => {
				setDatasets([]);
				setExportRange(range);
				setTargets(next);
				setOwnerId((current) => current || next[0]?.id || "");
			});
		}
	}, [isOpen, range]);
	async function download() {
		if (!ownerId || !exportRange || datasets.length === 0) return;
		setIsExporting(true);
		try {
			const results = await Promise.all(datasets.map((dataset) => exportCreatorAnalytics({ ownerId, dataset, range: serializableRange(exportRange) })));
			if (results.some((result) => !result)) throw new Error("Export unavailable");
			for (const result of results) {
				if (!result) continue;
				const url = URL.createObjectURL(new Blob([result.csv], { type: "text/csv;charset=utf-8" }));
				const anchor = document.createElement("a");
				anchor.href = url;
				anchor.download = result.filename;
				anchor.click();
				URL.revokeObjectURL(url);
			}
			onOpenChange(false);
		} catch {
			notify({ title: "Export failed", description: "The analytics CSV could not be generated.", color: "danger" });
		} finally {
			setIsExporting(false);
		}
	}
	return (
		<Modal>
			<Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange} variant='blur'>
				<Modal.Container size='lg'>
					<Modal.Dialog>
						<Modal.CloseTrigger />
						<Modal.Header>
							<Modal.Heading>Export Creator Analytics</Modal.Heading>
						</Modal.Header>
						<Modal.Body className='gap-5'>
							{targets.length > 1 ? (
								<Select fullWidth variant='secondary' value={ownerId || null} onChange={(value) => setOwnerId(String(value))}>
									<Label>Creator</Label>
									<Select.Trigger>
										<Select.Value />
										<Select.Indicator />
									</Select.Trigger>
									<Description>Export your analytics or analytics for a creator you manage.</Description>
									<Select.Popover>
										<ListBox>
											{targets.map((target) => (
												<ListBox.Item key={target.id} id={target.id} textValue={target.username}>
													<Label>{target.isSelf ? `${target.username} (you)` : target.username}</Label>
													<ListBox.ItemIndicator />
												</ListBox.Item>
											))}
										</ListBox>
									</Select.Popover>
								</Select>
							) : (
								<div>
									<p className='text-sm font-medium'>Creator</p>
									<p className='text-sm text-muted'>{targets[0]?.username ?? "Your Creator Page"}</p>
								</div>
							)}
							<AppDateRangePicker
								label='Date range'
								value={exportRange}
								onChange={setExportRange}
								fullWidth
								variant='secondary'
								presets={[
									{ label: "Last 7 days", value: lastDays(7) },
									{ label: "Last 30 days", value: lastDays(30) },
									{ label: "Last 90 days", value: lastDays(90) },
								]}
							/>
							<Select fullWidth variant='secondary' selectionMode='multiple' placeholder='Select datasets' value={datasets} onChange={(value) => setDatasets((Array.isArray(value) ? value : []).map(String).filter((item): item is CreatorAnalyticsExportDataset => ["daily", "acquisition", "locations", "technology"].includes(item)))}>
								<Label>Datasets</Label>
								<Select.Trigger>
									<Select.Value />
									<Select.Indicator />
								</Select.Trigger>
								<Description>Select one or more datasets. Each selection is downloaded as its own CSV file.</Description>
								<Select.Popover>
									<ListBox>
										<ListBox.Item id='daily' textValue='Daily metrics'>
											<Label>Daily metrics</Label>
											<ListBox.ItemIndicator />
										</ListBox.Item>
										<ListBox.Item id='acquisition' textValue='Acquisition'>
											<Label>Acquisition</Label>
											<ListBox.ItemIndicator />
										</ListBox.Item>
										<ListBox.Item id='locations' textValue='Locations'>
											<Label>Locations</Label>
											<ListBox.ItemIndicator />
										</ListBox.Item>
										<ListBox.Item id='technology' textValue='Technology'>
											<Label>Technology</Label>
											<ListBox.ItemIndicator />
										</ListBox.Item>
									</ListBox>
								</Select.Popover>
							</Select>
						</Modal.Body>
						<Modal.Footer>
							<Button slot='close' variant='tertiary'>
								Cancel
							</Button>
							<Button variant='primary' isPending={isExporting} isDisabled={!ownerId || !exportRange || datasets.length === 0} onPress={download}>
								<IconDownload size={18} />
								Download CSV
							</Button>
						</Modal.Footer>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</Modal>
	);
}

export default function CreatorAnalyticsCard({ allowed, onUpgrade }: { allowed: boolean; onUpgrade?: () => void }) {
	const [data, setData] = useState<Data>(null);
	const [range, setRange] = useState<AppDateRange | null>(null);
	const [loading, setLoading] = useState(allowed);
	const exportModal = useOverlayState();
	const presets = useMemo(
		() => [
			{ label: "Last 7 days", value: lastDays(7) },
			{ label: "Last 30 days", value: lastDays(30) },
			{ label: "Last 90 days", value: lastDays(90) },
		],
		[],
	);
	useEffect(() => {
		let cancelled = false;
		void Promise.resolve().then(() => {
			if (!cancelled) setRange(lastDays(30));
		});
		return () => {
			cancelled = true;
		};
	}, []);
	useEffect(() => {
		if (!allowed || !range) return;
		let cancelled = false;
		void getOwnCreatorAnalytics(serializableRange(range))
			.then((next) => {
				if (!cancelled) setData(next);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [allowed, range]);
	const changeRange = (next: AppDateRange | null) => {
		if (!next) return;
		setLoading(true);
		setRange(next);
	};
	if (!allowed)
		return (
			<Alert status='warning'>
				<Alert.Content>
					<Alert.Title>Creator Page analytics are a Pro feature</Alert.Title>
					<Alert.Description>Upgrade to see performance trends, detailed visitor breakdowns, and CSV exports.</Alert.Description>
				</Alert.Content>
				{onUpgrade ? (
					<Button size='sm' variant='tertiary' onPress={onUpgrade}>
						Upgrade to Pro
					</Button>
				) : null}
			</Alert>
		);
	if (!range || (loading && !data))
		return (
			<Card variant='secondary'>
				<Card.Content className='flex items-center gap-2 p-4 text-sm text-muted'>
					<Spinner size='sm' /> Loading Creator Page analytics…
				</Card.Content>
			</Card>
		);
	if (!data)
		return (
			<Alert status='warning'>
				<Alert.Content>
					<Alert.Title>Analytics could not be loaded</Alert.Title>
					<Alert.Description>Please refresh the page and try again.</Alert.Description>
				</Alert.Content>
			</Alert>
		);

	return (
		<div className='space-y-4'>
			<div className='flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
				<div>
					<p className='font-semibold'>Creator Page performance</p>
					<p className='text-xs text-muted'>
						{data.stale ? "Last checked" : "Updated"}: {dateTimeFormatter.format(new Date(data.fetchedAt))}
						{" · "}Results are cached for up to 10 minutes, so new visits may not appear immediately.
					</p>
				</div>
				<div className='flex flex-col gap-2 sm:flex-row sm:items-end'>
					<AppDateRangePicker label='Analytics period' value={range} onChange={changeRange} variant='secondary' presets={presets} />
					<Button variant='secondary' onPress={exportModal.open}>
						<IconDownload size={18} />
						Export
					</Button>
				</div>
			</div>
			<div className={`grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
				<MetricCard title='Unique visitors' value={data.metrics.visitors} valueKey='visitors' points={data.timeseries} icon={<IconUsers size={18} />} color='var(--chart-1)' />
				<MetricCard title='Visits' value={data.metrics.visits} valueKey='visits' points={data.timeseries} icon={<IconChartBar size={18} />} color='var(--chart-1)' />
				<MetricCard title='Pageviews' value={data.metrics.pageviews} valueKey='pageviews' points={data.timeseries} icon={<IconEye size={18} />} color='var(--chart-1)' />
				<MetricCard title='Bounce rate' value={data.metrics.bounceRate} valueKey='bounceRate' points={data.timeseries} icon={<IconActivity size={18} />} color='var(--chart-2)' suffix='%' average />
				<MetricCard title='Time on page' value={Math.round(data.metrics.timeOnPage)} valueKey='timeOnPage' points={data.timeseries} icon={<IconClock size={18} />} color='var(--chart-3)' suffix='s' average />
				<MetricCard title='Scroll depth' value={data.metrics.scrollDepth} valueKey='scrollDepth' points={data.timeseries} icon={<IconChartDots size={18} />} color='var(--chart-4)' suffix='%' average />
				<MetricCard title='Clip plays' value={data.metrics.clipPlays} valueKey='clipPlays' points={data.timeseries} icon={<IconPlayerPlay size={18} />} color='var(--chart-5)' />
				<MetricCard title='Clip plays per visit' value={data.metrics.playsPerVisit} valueKey='playsPerVisit' points={data.timeseries} icon={<IconRepeat size={18} />} color='var(--chart-5)' average />
				<MetricCard title='Playback rate' value={data.metrics.playRate} valueKey='playRate' points={data.timeseries} icon={<IconPercentage size={18} />} color='var(--chart-5)' suffix='%' average />
			</div>
			<Tabs defaultSelectedKey='acquisition' variant='secondary' className='w-full'>
				<Tabs.ListContainer className='w-full'>
					<Tabs.List aria-label='Creator analytics breakdowns' className='w-full'>
						<Tabs.Tab id='acquisition'>
							Acquisition
							<Tabs.Indicator />
						</Tabs.Tab>
						<Tabs.Tab id='locations'>
							Locations
							<Tabs.Indicator />
						</Tabs.Tab>
						<Tabs.Tab id='technology'>
							Technology
							<Tabs.Indicator />
						</Tabs.Tab>
					</Tabs.List>
				</Tabs.ListContainer>
				<Tabs.Panel id='acquisition' className='pt-4'>
					<BreakdownExplorer
						label='Acquisition'
						groups={[
							{ id: "channels", label: "Channels", items: data.breakdowns.channels },
							{ id: "sources", label: "Sources", items: data.breakdowns.sources },
							{ id: "utmSources", label: "UTM sources", items: data.breakdowns.utmSources },
							{ id: "campaigns", label: "Campaigns", items: data.breakdowns.campaigns },
							{ id: "mediums", label: "Mediums", items: data.breakdowns.mediums },
						]}
					/>
				</Tabs.Panel>
				<Tabs.Panel id='locations' className='pt-4'>
					<BreakdownExplorer
						label='Locations'
						groups={[
							{ id: "countries", label: "Countries", items: data.breakdowns.countries },
							{ id: "regions", label: "Regions", items: data.breakdowns.regions },
							{ id: "cities", label: "Cities", items: data.breakdowns.cities },
						]}
					/>
				</Tabs.Panel>
				<Tabs.Panel id='technology' className='pt-4'>
					<BreakdownExplorer
						label='Technology'
						groups={[
							{ id: "devices", label: "Devices", items: data.breakdowns.devices },
							{ id: "browsers", label: "Browsers", items: data.breakdowns.browsers },
							{ id: "operatingSystems", label: "Operating systems", items: data.breakdowns.operatingSystems },
						]}
					/>
				</Tabs.Panel>
			</Tabs>
			<ExportModal key={`${range.start.toString()}:${range.end.toString()}`} isOpen={exportModal.isOpen} onOpenChange={exportModal.setOpen} range={range} />
		</div>
	);
}
