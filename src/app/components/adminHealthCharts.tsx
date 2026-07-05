"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Card } from "@heroui/react";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, PolarAngleAxis, RadialBar, RadialBarChart, Tooltip, XAxis, YAxis } from "recharts";
import type { InstanceHealthSnapshot } from "@lib/instanceHealth";

function formatPercent(value: number) {
	return `${(value * 100).toFixed(1)}%`;
}

function MeasuredChart({ className, children }: { className: string; children: (width: number) => ReactNode }) {
	const wrapperRef = useRef<HTMLDivElement | null>(null);
	const [width, setWidth] = useState(0);

	useEffect(() => {
		if (!wrapperRef.current) return;
		const updateWidth = () => {
			const nextWidth = Math.floor(wrapperRef.current?.getBoundingClientRect().width ?? 0);
			setWidth(nextWidth > 0 ? nextWidth : 0);
		};
		const frame = requestAnimationFrame(updateWidth);
		if (typeof ResizeObserver === "undefined") return () => cancelAnimationFrame(frame);
		const observer = new ResizeObserver((entries) => {
			const nextWidth = Math.floor(entries[0]?.contentRect.width ?? 0);
			setWidth(nextWidth > 0 ? nextWidth : 0);
		});
		observer.observe(wrapperRef.current);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	}, []);

	return (
		<div ref={wrapperRef} className={className}>
			{width > 0 ? children(width) : null}
		</div>
	);
}

function ChartPanel({ title, children }: { title: string; children: ReactNode }) {
	return (
		<Card variant='tertiary' className='min-w-0'>
			<Card.Header>
				<p className='text-xs font-semibold text-muted'>{title}</p>
			</Card.Header>
			<Card.Content className='min-w-0'>{children}</Card.Content>
		</Card>
	);
}

export default function AdminHealthCharts({ health }: { health: InstanceHealthSnapshot }) {
	const tooltipProps = {
		contentStyle: {
			backgroundColor: "#111827",
			border: "1px solid #334155",
			borderRadius: "8px",
		},
		labelStyle: { color: "#e2e8f0", fontWeight: 600 },
		itemStyle: { color: "#f8fafc" },
		cursor: { fill: "rgba(59, 130, 246, 0.12)" },
	};

	const activityData = [
		{ label: "24h", value: health.counts.activeUsers24h, fill: "#006FEE" },
		{ label: "7d", value: health.counts.activeUsers7d, fill: "#17C964" },
		{ label: "30d", value: health.counts.activeUsers30d, fill: "#F5A524" },
	];
	const inactiveUsers = Math.max(0, health.counts.users - health.counts.activeUsers30d);
	const active30OnlyUsers = Math.max(0, health.counts.activeUsers30d - health.counts.activeUsers7d);
	const active7OnlyUsers = Math.max(0, health.counts.activeUsers7d - health.counts.activeUsers24h);
	const active24Users = Math.max(0, health.counts.activeUsers24h);
	const userActivitySegments = [
		{ label: "Inactive", value: inactiveUsers, fill: "#F31260" },
		{ label: "30d only", value: active30OnlyUsers, fill: "#F5A524" },
		{ label: "7d only", value: active7OnlyUsers, fill: "#A3E635" },
		{ label: "24h", value: active24Users, fill: "#17C964" },
	];
	const planSplitData = [
		{ label: "Free", value: health.counts.usersFree, fill: "#9353D3" },
		{ label: "Paid", value: health.counts.usersPaid, fill: "#17C964" },
	];

	const overlayStateData = [
		{ label: "Active", value: health.counts.overlaysActive, fill: "#17C964" },
		{ label: "Paused", value: health.counts.overlaysPaused, fill: "#F31260" },
	];
	const overlayOwnerData = [
		{ label: "Free Owners", value: health.counts.activeOverlayOwnersFree, fill: "#006FEE" },
		{ label: "Paid Owners", value: health.counts.activeOverlayOwnersPaid, fill: "#9353D3" },
	];
	const accountStatusData = [
		{ label: "Enabled", value: Math.max(0, health.counts.users - health.accounts.disabledUsers), fill: "#17C964" },
		{ label: "Manual disabled", value: health.accounts.disabledManual, fill: "#F31260" },
		{ label: "Auto disabled", value: health.accounts.disabledAutomatic, fill: "#F5A524" },
	];
	const playlistCoverageData = [
		{ label: "Playlists", value: health.playlists.total, fill: "#9353D3" },
		{ label: "Non-empty", value: health.playlists.nonEmpty, fill: "#17C964" },
		{ label: "Empty", value: health.playlists.empty, fill: "#F31260" },
		{ label: "Overlays linked", value: health.playlists.overlaysWithPlaylist, fill: "#006FEE" },
		{ label: "Active linked", value: health.playlists.activeOverlaysWithPlaylist, fill: "#F5A524" },
	];
	const disabledReasonData = Object.entries(health.accounts.disabledReasonCounts).map(([reason, value]) => ({
		label: reason,
		value,
	}));
	const optedOutSourceData = Object.entries(health.newsletter.optedOutSourceCounts).map(([source, value]) => ({
		label: source,
		value,
	}));
	const newsletterConsentSourceData = Object.entries(health.newsletter.consentSourceCounts).map(([source, value]) => ({
		label: source,
		value,
	}));
	const queueDepthData = [
		{ label: "Clip Queue", value: health.queues.clipQueueDepth, fill: "#006FEE" },
		{ label: "Mod Queue", value: health.queues.modQueueDepth, fill: "#F5A524" },
	];
	const tokenHealthData = [
		{ label: "Total", value: health.auth.tokenRows, fill: "#17C964" },
		{ label: "Expiring 24h", value: health.auth.expiringIn24h, fill: "#F5A524" },
		{ label: "Expired", value: health.auth.expiredTokens, fill: "#F31260" },
	];
	const rewardUsageData = [
		{ label: "With reward", value: health.rewards.overlaysWithReward, fill: "#006FEE" },
		{ label: "Active with reward", value: health.rewards.activeOverlaysWithReward, fill: "#17C964" },
		{ label: "Unique reward IDs", value: health.rewards.uniqueRewardIds, fill: "#F5A524" },
		{ label: "Owners with reward", value: health.rewards.ownersWithReward, fill: "#9353D3" },
	];
	const overlayTypeData = Object.entries(health.overlayConfig.byType).map(([type, value]) => ({
		label: type,
		value,
	}));
	const playbackModeData = Object.entries(health.overlayConfig.byPlaybackMode).map(([mode, value]) => ({
		label: mode,
		value,
	}));
	const entitlementSourceData = Object.entries(health.entitlements.grantsBySource).map(([source, value]) => ({
		label: source,
		value,
	}));
	const cacheCompositionData = [
		{
			label: "Cache",
			clips: health.cache.clipEntries,
			avatars: health.cache.avatarEntries,
			games: health.cache.gameEntries,
			unavailable: health.cache.unavailableClips,
		},
	];
	const totalRuns = Math.max(0, health.scheduler.clipCache.totalRuns);
	const totalFailures = Math.max(0, Math.min(totalRuns, health.scheduler.clipCache.totalFailures));
	const successRuns = Math.max(0, totalRuns - totalFailures);
	const successRatio = totalRuns > 0 ? successRuns / totalRuns : 1;
	const failureRatio = totalRuns > 0 ? totalFailures / totalRuns : 0;
	const dbPing = Math.max(0, health.db.pingMs);
	const healthAggregation = Math.max(0, health.db.healthAggregationMs);

	const cacheGaugeData = [
		{
			name: "Cache Hit",
			value: Math.round(Math.max(0, Math.min(100, health.cache.globalReadHitRate * 100))),
			fill: "#17C964",
		},
	];

	const backfillGaugeData = [
		{
			name: "Backfill",
			value: Math.round(Math.max(0, Math.min(100, health.cache.backfillCompleteRatio * 100))),
			fill: "#006FEE",
		},
	];

	return (
		<div className='grid grid-cols-1 gap-3 lg:grid-cols-2'>
			<Card variant='secondary' className='min-w-0 lg:col-span-2'>
				<Card.Header className='pb-1'>
					<p className='text-sm font-semibold'>Active Users Trend</p>
				</Card.Header>
				<Card.Content className='min-w-0'>
					<MeasuredChart className='h-64 min-w-0'>
						{(width) => (
							<BarChart width={width} height={256} data={activityData} margin={{ top: 10, right: 8, left: -18, bottom: 4 }}>
								<CartesianGrid strokeDasharray='4 4' stroke='#d4d4d8' />
								<XAxis dataKey='label' stroke='#71717a' />
								<YAxis stroke='#71717a' allowDecimals={false} />
								<Tooltip {...tooltipProps} />
								<Bar dataKey='value' radius={[6, 6, 0, 0]}>
									{activityData.map((entry) => (
										<Cell key={entry.label} fill={entry.fill} />
									))}
								</Bar>
							</BarChart>
						)}
					</MeasuredChart>
				</Card.Content>
			</Card>

			<Card variant='secondary' className='min-w-0'>
				<Card.Header className='pb-1'>
					<p className='text-sm font-semibold'>User Activity Segments</p>
				</Card.Header>
				<Card.Content className='min-w-0'>
					<MeasuredChart className='h-56 min-w-0'>
						{(width) => (
							<BarChart width={width} height={224} data={userActivitySegments} margin={{ top: 10, right: 8, left: -18, bottom: 4 }}>
								<CartesianGrid strokeDasharray='4 4' stroke='#d4d4d8' />
								<XAxis dataKey='label' stroke='#71717a' />
								<YAxis stroke='#71717a' allowDecimals={false} />
								<Tooltip {...tooltipProps} />
								<Bar dataKey='value' radius={[6, 6, 0, 0]}>
									{userActivitySegments.map((entry) => (
										<Cell key={entry.label} fill={entry.fill} />
									))}
								</Bar>
							</BarChart>
						)}
					</MeasuredChart>
				</Card.Content>
			</Card>

			<Card variant='secondary' className='min-w-0'>
				<Card.Header className='pb-1'>
					<p className='text-sm font-semibold'>User Plan Split</p>
				</Card.Header>
				<Card.Content className='min-w-0'>
					<MeasuredChart className='h-56 min-w-0'>
						{(width) => (
							<PieChart width={width} height={224}>
								<Tooltip {...tooltipProps} />
								<Pie data={planSplitData} dataKey='value' nameKey='label' cx='50%' cy='50%' outerRadius={Math.min(80, Math.floor(width / 4))} label>
									{planSplitData.map((entry) => (
										<Cell key={entry.label} fill={entry.fill} />
									))}
								</Pie>
							</PieChart>
						)}
					</MeasuredChart>
				</Card.Content>
			</Card>

			<Card variant='secondary' className='min-w-0 lg:col-span-2'>
				<Card.Header className='pb-1'>
					<p className='text-sm font-semibold'>Overlay Distribution</p>
				</Card.Header>
				<Card.Content className='grid min-w-0 gap-3 md:grid-cols-2'>
					<ChartPanel title='Overlay State'>
						<MeasuredChart className='h-56 min-w-0'>
							{(width) => (
								<PieChart width={width} height={224}>
									<Tooltip {...tooltipProps} />
									<Pie data={overlayStateData} dataKey='value' nameKey='label' cx='50%' cy='50%' outerRadius={Math.min(78, Math.floor(width / 4))} label>
										{overlayStateData.map((entry) => (
											<Cell key={entry.label} fill={entry.fill} />
										))}
									</Pie>
								</PieChart>
							)}
						</MeasuredChart>
					</ChartPanel>
					<ChartPanel title='Active Owner Plans'>
						<MeasuredChart className='h-56 min-w-0'>
							{(width) => (
								<PieChart width={width} height={224}>
									<Tooltip {...tooltipProps} />
									<Pie data={overlayOwnerData} dataKey='value' nameKey='label' cx='50%' cy='50%' outerRadius={Math.min(78, Math.floor(width / 4))} label>
										{overlayOwnerData.map((entry) => (
											<Cell key={entry.label} fill={entry.fill} />
										))}
									</Pie>
								</PieChart>
							)}
						</MeasuredChart>
					</ChartPanel>
				</Card.Content>
			</Card>

			<Card variant='secondary' className='min-w-0 lg:col-span-2'>
				<Card.Header className='pb-1'>
					<p className='text-sm font-semibold'>Accounts and Playlists</p>
				</Card.Header>
				<Card.Content className='grid min-w-0 gap-3 md:grid-cols-2'>
					<ChartPanel title='Account Status'>
						<MeasuredChart className='h-56 min-w-0'>
							{(width) => (
								<PieChart width={width} height={224}>
									<Tooltip {...tooltipProps} />
									<Pie data={accountStatusData} dataKey='value' nameKey='label' cx='50%' cy='50%' outerRadius={Math.min(78, Math.floor(width / 4))} label>
										{accountStatusData.map((entry) => (
											<Cell key={entry.label} fill={entry.fill} />
										))}
									</Pie>
								</PieChart>
							)}
						</MeasuredChart>
					</ChartPanel>
					<ChartPanel title='Playlist Coverage'>
						<MeasuredChart className='h-56 min-w-0'>
							{(width) => (
								<BarChart width={width} height={224} data={playlistCoverageData} margin={{ top: 10, right: 8, left: -18, bottom: 24 }}>
									<CartesianGrid strokeDasharray='4 4' stroke='#d4d4d8' />
									<XAxis dataKey='label' stroke='#71717a' angle={-16} textAnchor='end' height={44} />
									<YAxis stroke='#71717a' allowDecimals={false} />
									<Tooltip {...tooltipProps} />
									<Bar dataKey='value' radius={[6, 6, 0, 0]}>
										{playlistCoverageData.map((entry) => (
											<Cell key={entry.label} fill={entry.fill} />
										))}
									</Bar>
								</BarChart>
							)}
						</MeasuredChart>
					</ChartPanel>
				</Card.Content>
			</Card>

			<Card variant='secondary' className='min-w-0 lg:col-span-2'>
				<Card.Header className='pb-1'>
					<p className='text-sm font-semibold'>Reason Breakdown</p>
				</Card.Header>
				<Card.Content className='grid min-w-0 gap-3 md:grid-cols-2'>
					<ChartPanel title='Disabled Reasons'>
						<MeasuredChart className='h-56 min-w-0'>
							{(width) => (
								<BarChart width={width} height={224} data={disabledReasonData} margin={{ top: 10, right: 8, left: -18, bottom: 24 }}>
									<CartesianGrid strokeDasharray='4 4' stroke='#d4d4d8' />
									<XAxis dataKey='label' stroke='#71717a' angle={-16} textAnchor='end' height={44} />
									<YAxis stroke='#71717a' allowDecimals={false} />
									<Tooltip {...tooltipProps} />
									<Bar dataKey='value' fill='#F31260' radius={[6, 6, 0, 0]} />
								</BarChart>
							)}
						</MeasuredChart>
					</ChartPanel>
					<ChartPanel title='Opt-out Sources'>
						<MeasuredChart className='h-56 min-w-0'>
							{(width) => (
								<BarChart width={width} height={224} data={optedOutSourceData} margin={{ top: 10, right: 8, left: -18, bottom: 24 }}>
									<CartesianGrid strokeDasharray='4 4' stroke='#d4d4d8' />
									<XAxis dataKey='label' stroke='#71717a' angle={-16} textAnchor='end' height={44} />
									<YAxis stroke='#71717a' allowDecimals={false} />
									<Tooltip {...tooltipProps} />
									<Bar dataKey='value' fill='#F5A524' radius={[6, 6, 0, 0]} />
								</BarChart>
							)}
						</MeasuredChart>
					</ChartPanel>
				</Card.Content>
			</Card>

			<Card variant='secondary' className='min-w-0 lg:col-span-2'>
				<Card.Header className='pb-1'>
					<p className='text-sm font-semibold'>Entitlement Sources</p>
				</Card.Header>
				<Card.Content className='min-w-0'>
					<MeasuredChart className='h-64 min-w-0'>
						{(width) => (
							<BarChart width={width} height={256} data={entitlementSourceData} margin={{ top: 10, right: 8, left: -18, bottom: 28 }}>
								<CartesianGrid strokeDasharray='4 4' stroke='#d4d4d8' />
								<XAxis dataKey='label' stroke='#71717a' angle={-20} textAnchor='end' height={50} />
								<YAxis stroke='#71717a' allowDecimals={false} />
								<Tooltip {...tooltipProps} />
								<Bar dataKey='value' fill='#006FEE' radius={[6, 6, 0, 0]} />
							</BarChart>
						)}
					</MeasuredChart>
				</Card.Content>
			</Card>

			<Card variant='secondary' className='min-w-0 lg:col-span-2'>
				<Card.Header className='pb-1'>
					<p className='text-sm font-semibold'>Newsletter and Auth Ops</p>
				</Card.Header>
				<Card.Content className='grid min-w-0 gap-3 md:grid-cols-3'>
					<ChartPanel title='Consent Sources'>
						<MeasuredChart className='h-56 min-w-0'>
							{(width) => (
								<BarChart width={width} height={224} data={newsletterConsentSourceData} margin={{ top: 10, right: 8, left: -18, bottom: 30 }}>
									<CartesianGrid strokeDasharray='4 4' stroke='#d4d4d8' />
									<XAxis dataKey='label' stroke='#71717a' angle={-20} textAnchor='end' height={52} />
									<YAxis stroke='#71717a' allowDecimals={false} />
									<Tooltip {...tooltipProps} />
									<Bar dataKey='value' fill='#9353D3' radius={[6, 6, 0, 0]} />
								</BarChart>
							)}
						</MeasuredChart>
					</ChartPanel>
					<ChartPanel title='Queue Depth'>
						<MeasuredChart className='h-56 min-w-0'>
							{(width) => (
								<BarChart width={width} height={224} data={queueDepthData} margin={{ top: 10, right: 8, left: -18, bottom: 20 }}>
									<CartesianGrid strokeDasharray='4 4' stroke='#d4d4d8' />
									<XAxis dataKey='label' stroke='#71717a' angle={-14} textAnchor='end' height={40} />
									<YAxis stroke='#71717a' allowDecimals={false} />
									<Tooltip {...tooltipProps} />
									<Bar dataKey='value' radius={[6, 6, 0, 0]}>
										{queueDepthData.map((entry) => (
											<Cell key={entry.label} fill={entry.fill} />
										))}
									</Bar>
								</BarChart>
							)}
						</MeasuredChart>
					</ChartPanel>
					<ChartPanel title='Token Health'>
						<MeasuredChart className='h-56 min-w-0'>
							{(width) => (
								<BarChart width={width} height={224} data={tokenHealthData} margin={{ top: 10, right: 8, left: -18, bottom: 20 }}>
									<CartesianGrid strokeDasharray='4 4' stroke='#d4d4d8' />
									<XAxis dataKey='label' stroke='#71717a' angle={-14} textAnchor='end' height={40} />
									<YAxis stroke='#71717a' allowDecimals={false} />
									<Tooltip {...tooltipProps} />
									<Bar dataKey='value' radius={[6, 6, 0, 0]}>
										{tokenHealthData.map((entry) => (
											<Cell key={entry.label} fill={entry.fill} />
										))}
									</Bar>
								</BarChart>
							)}
						</MeasuredChart>
					</ChartPanel>
				</Card.Content>
			</Card>

			<Card variant='secondary' className='min-w-0 lg:col-span-2'>
				<Card.Header className='pb-1'>
					<p className='text-sm font-semibold'>Rewards and Overlay Config</p>
				</Card.Header>
				<Card.Content className='grid min-w-0 gap-3 md:grid-cols-3'>
					<ChartPanel title='Reward Usage'>
						<MeasuredChart className='h-56 min-w-0'>
							{(width) => (
								<BarChart width={width} height={224} data={rewardUsageData} margin={{ top: 10, right: 8, left: -18, bottom: 20 }}>
									<CartesianGrid strokeDasharray='4 4' stroke='#d4d4d8' />
									<XAxis dataKey='label' stroke='#71717a' angle={-14} textAnchor='end' height={40} />
									<YAxis stroke='#71717a' allowDecimals={false} />
									<Tooltip {...tooltipProps} />
									<Bar dataKey='value' radius={[6, 6, 0, 0]}>
										{rewardUsageData.map((entry) => (
											<Cell key={entry.label} fill={entry.fill} />
										))}
									</Bar>
								</BarChart>
							)}
						</MeasuredChart>
					</ChartPanel>
					<ChartPanel title='Overlay Types'>
						<MeasuredChart className='h-56 min-w-0'>
							{(width) => (
								<BarChart width={width} height={224} data={overlayTypeData} margin={{ top: 10, right: 8, left: -18, bottom: 30 }}>
									<CartesianGrid strokeDasharray='4 4' stroke='#d4d4d8' />
									<XAxis dataKey='label' stroke='#71717a' angle={-20} textAnchor='end' height={52} />
									<YAxis stroke='#71717a' allowDecimals={false} />
									<Tooltip {...tooltipProps} />
									<Bar dataKey='value' fill='#17C964' radius={[6, 6, 0, 0]} />
								</BarChart>
							)}
						</MeasuredChart>
					</ChartPanel>
					<ChartPanel title='Playback Modes'>
						<MeasuredChart className='h-56 min-w-0'>
							{(width) => (
								<BarChart width={width} height={224} data={playbackModeData} margin={{ top: 10, right: 8, left: -18, bottom: 30 }}>
									<CartesianGrid strokeDasharray='4 4' stroke='#d4d4d8' />
									<XAxis dataKey='label' stroke='#71717a' angle={-20} textAnchor='end' height={52} />
									<YAxis stroke='#71717a' allowDecimals={false} />
									<Tooltip {...tooltipProps} />
									<Bar dataKey='value' fill='#F31260' radius={[6, 6, 0, 0]} />
								</BarChart>
							)}
						</MeasuredChart>
					</ChartPanel>
				</Card.Content>
			</Card>

			<Card variant='secondary' className='min-w-0 lg:col-span-2'>
				<Card.Header className='pb-1'>
					<p className='text-sm font-semibold'>Cache Composition</p>
				</Card.Header>
				<Card.Content className='min-w-0'>
					<MeasuredChart className='h-64 min-w-0'>
						{(width) => (
							<BarChart layout='vertical' width={width} height={256} data={cacheCompositionData} margin={{ top: 10, right: 8, left: -18, bottom: 4 }}>
								<CartesianGrid strokeDasharray='4 4' stroke='#d4d4d8' />
								<XAxis type='number' stroke='#71717a' allowDecimals={false} />
								<YAxis type='category' dataKey='label' stroke='#71717a' width={58} />
								<Tooltip {...tooltipProps} />
								<Bar dataKey='clips' stackId='cache' fill='#9353D3' />
								<Bar dataKey='avatars' stackId='cache' fill='#006FEE' />
								<Bar dataKey='games' stackId='cache' fill='#17C964' />
								<Bar dataKey='unavailable' stackId='cache' fill='#F31260' />
							</BarChart>
						)}
					</MeasuredChart>
				</Card.Content>
			</Card>

			<Card variant='secondary' className='min-w-0'>
				<Card.Header className='pb-1'>
					<p className='text-sm font-semibold'>Health Gauges</p>
				</Card.Header>
				<Card.Content className='grid h-56 min-w-0 grid-cols-2 gap-2'>
					<div className='flex flex-col items-center justify-center'>
						<MeasuredChart className='h-[120px] w-full min-w-0'>
							{(width) => (
								<RadialBarChart width={width} height={120} innerRadius='60%' outerRadius='100%' data={cacheGaugeData} startAngle={90} endAngle={-270}>
									<PolarAngleAxis type='number' domain={[0, 100]} tick={false} />
									<RadialBar dataKey='value' cornerRadius={10} background />
								</RadialBarChart>
							)}
						</MeasuredChart>
						<p className='text-xs text-muted'>Cache Hit</p>
						<p className='text-sm font-semibold'>{formatPercent(health.cache.globalReadHitRate)}</p>
					</div>
					<div className='flex flex-col items-center justify-center'>
						<MeasuredChart className='h-[120px] w-full min-w-0'>
							{(width) => (
								<RadialBarChart width={width} height={120} innerRadius='60%' outerRadius='100%' data={backfillGaugeData} startAngle={90} endAngle={-270}>
									<PolarAngleAxis type='number' domain={[0, 100]} tick={false} />
									<RadialBar dataKey='value' cornerRadius={10} background />
								</RadialBarChart>
							)}
						</MeasuredChart>
						<p className='text-xs text-muted'>Backfill</p>
						<p className='text-sm font-semibold'>{formatPercent(health.cache.backfillCompleteRatio)}</p>
					</div>
				</Card.Content>
			</Card>

			<Card variant='secondary' className='min-w-0'>
				<Card.Header className='pb-1'>
					<p className='text-sm font-semibold'>Scheduler Reliability</p>
				</Card.Header>
				<Card.Content className='h-56 gap-3'>
					<div className='rounded-lg border border-brand-300/40 bg-gradient-to-r from-brand-500/15 via-brand-400/10 to-transparent p-3'>
						<p className='text-xs font-semibold uppercase tracking-wide text-muted'>DB Ping</p>
						<p className='text-3xl font-semibold text-accent'>{dbPing.toLocaleString()}ms</p>
						<p className='text-xs text-muted'>Health aggregation: {healthAggregation.toLocaleString()}ms</p>
					</div>
					<ChartPanel title='Run Success vs Failure'>
						<div className='mt-2 flex h-4 w-full overflow-hidden rounded-full bg-default'>
							<div className='h-full bg-success' style={{ width: `${Math.round(successRatio * 100)}%` }} />
							<div className='h-full bg-danger' style={{ width: `${Math.round(failureRatio * 100)}%` }} />
						</div>
						<div className='mt-2 flex items-center justify-between text-xs text-muted'>
							<span>Success: {successRuns}</span>
							<span>Failures: {totalFailures}</span>
							<span>Total: {totalRuns}</span>
						</div>
					</ChartPanel>
				</Card.Content>
			</Card>
		</div>
	);
}
