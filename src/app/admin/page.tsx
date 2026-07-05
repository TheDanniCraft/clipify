import { validateAdminAuth } from "@actions/auth";
import { getAdminExplorerPage } from "@actions/adminView";
import AdminHealthCharts from "@components/adminHealthCharts";
import AdminUserExplorer from "@components/adminUserExplorer";
import DashboardNavbar from "@components/dashboardNavbar";
import { Alert, Card, CardContent, CardHeader, Chip } from "@components/heroui-client";

import { notFound } from "next/navigation";
import { getInstanceHealthSnapshot } from "@lib/instanceHealth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdminPageSearchParams = {
	error?: string | string[];
	page?: string | string[];
	q?: string | string[];
};

function toSingle(value: string | string[] | undefined) {
	return Array.isArray(value) ? value[0] : value;
}

function toPositiveInt(value: string | undefined, fallback: number) {
	const parsed = Number.parseInt((value ?? "").trim(), 10);
	if (!Number.isFinite(parsed) || parsed < 1) return fallback;
	return parsed;
}

function formatNumber(value: number) {
	return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number) {
	return `${(value * 100).toFixed(1)}%`;
}

function formatDate(value: Date | string | null) {
	if (!value) return "never";
	return new Date(value).toLocaleString();
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<AdminPageSearchParams> }) {
	const adminUser = await validateAdminAuth();
	if (!adminUser) {
		notFound();
	}

	const params = await searchParams;
	const error = (toSingle(params.error) ?? "").trim();
	const initialQuery = (toSingle(params.q) ?? "").trim();
	const initialPage = toPositiveInt(toSingle(params.page), 1);
	const [health, explorer] = await Promise.all([getInstanceHealthSnapshot(), getAdminExplorerPage(initialQuery, initialPage, 25)]);

	return (
		<DashboardNavbar user={adminUser} title='Admin' tagline='Operational telemetry and account entry points'>
			<div className='mt-5 flex flex-col gap-4'>
				<Card>
					<CardHeader className='flex w-full flex-row items-start justify-between pb-1'>
						<div>
							<p className='text-sm font-semibold'>Instance Health Snapshot</p>
							<p className='text-xs text-muted'>
								{health.time} | uptime {formatNumber(health.uptimeSec)}s | env {health.app.env}
							</p>
						</div>
						<Chip className='shrink-0' color={health.status === "ok" ? "success" : health.status === "degraded" ? "warning" : "danger"} variant='tertiary'>
							{health.status.toUpperCase()}
						</Chip>
					</CardHeader>
					<CardContent className='pt-0'>
						<AdminHealthCharts health={health} />
					</CardContent>
					<CardContent className='grid grid-cols-1 gap-3 xl:grid-cols-2'>
						<div className='rounded-lg border border-default p-3'>
							<p className='mb-2 text-xs font-semibold text-muted'>Counts</p>
							<div className='grid grid-cols-2 gap-2 text-xs'>
								<p>Users: {formatNumber(health.counts.users)}</p>
								<p>Free: {formatNumber(health.counts.usersFree)}</p>
								<p>Paid: {formatNumber(health.counts.usersPaid)}</p>
								<p>Active 24h: {formatNumber(health.counts.activeUsers24h)}</p>
								<p>Active 7d: {formatNumber(health.counts.activeUsers7d)}</p>
								<p>Active 30d: {formatNumber(health.counts.activeUsers30d)}</p>
								<p>Overlays total: {formatNumber(health.counts.overlaysTotal)}</p>
								<p>Overlays active: {formatNumber(health.counts.overlaysActive)}</p>
								<p>Overlays paused: {formatNumber(health.counts.overlaysPaused)}</p>
								<p>Active owners free: {formatNumber(health.counts.activeOverlayOwnersFree)}</p>
								<p>Active owners paid: {formatNumber(health.counts.activeOverlayOwnersPaid)}</p>
								<p>Community opt-in rate: {formatPercent(health.community.optInRate)}</p>
							</div>
						</div>
						<div className='rounded-lg border border-default p-3'>
							<p className='mb-2 text-xs font-semibold text-muted'>Entitlements</p>
							<div className='grid grid-cols-2 gap-2 text-xs'>
								<p>Grant users: {formatNumber(health.entitlements.activeGrantUsers)}</p>
								<p>Grant users on free: {formatNumber(health.entitlements.activeGrantUsersOnFree)}</p>
								<p>Active grants: {formatNumber(health.entitlements.activeGrantCount)}</p>
								<p>Effective pro estimate: {formatNumber(health.entitlements.effectiveProUsersEstimate)}</p>
							</div>
							<p className='mt-3 mb-1 text-[11px] font-semibold text-muted'>By Source</p>
							<div className='flex flex-wrap gap-1'>
								{Object.entries(health.entitlements.grantsBySource).map(([source, value]) => (
									<Chip size='sm' key={source} variant='tertiary'>
										{source}: {formatNumber(value)}
									</Chip>
								))}
							</div>
							<p className='mt-3 mb-1 text-[11px] font-semibold text-muted'>By Entitlement</p>
							<div className='flex flex-wrap gap-1'>
								{Object.entries(health.entitlements.grantsByEntitlement).map(([entitlement, value]) => (
									<Chip size='sm' key={entitlement} variant='tertiary'>
										{entitlement}: {formatNumber(value)}
									</Chip>
								))}
							</div>
						</div>
						<div className='rounded-lg border border-default p-3'>
							<p className='mb-2 text-xs font-semibold text-muted'>Cache</p>
							<div className='grid grid-cols-2 gap-2 text-xs'>
								<p>Entries total: {formatNumber(health.cache.entriesTotal)}</p>
								<p>Clip entries: {formatNumber(health.cache.clipEntries)}</p>
								<p>Avatar entries: {formatNumber(health.cache.avatarEntries)}</p>
								<p>Game entries: {formatNumber(health.cache.gameEntries)}</p>
								<p>Unavailable clips: {formatNumber(health.cache.unavailableClips)}</p>
								<p>Sync states: {formatNumber(health.cache.clipSyncStates)}</p>
								<p>Sync complete: {formatNumber(health.cache.clipSyncComplete)}</p>
								<p>Backfill completion: {formatPercent(health.cache.backfillCompleteRatio)}</p>
								<p>Stale validated clips: {formatNumber(health.cache.staleValidatedClips)}</p>
								<p>Global hit rate: {formatPercent(health.cache.globalReadHitRate)}</p>
								<p>Reads total: {formatNumber(health.cache.globalReadTotal)}</p>
								<p>Stale hits: {formatNumber(health.cache.globalStaleHits)}</p>
							</div>
							<p className='mt-2 text-[11px] text-muted'>
								Cache metrics started: {formatDate(health.cache.cacheReadMetricsStartedAt)} | last read: {formatDate(health.cache.lastCacheReadAt)}
							</p>
						</div>
						<div className='rounded-lg border border-default p-3'>
							<p className='mb-2 text-xs font-semibold text-muted'>Scheduler + DB</p>
							<div className='grid grid-cols-2 gap-2 text-xs'>
								<p>Scheduler started: {health.scheduler.clipCache.startedAt ? "yes" : "no"}</p>
								<p>Scheduler interval: {formatNumber(health.scheduler.clipCache.intervalMs ?? 0)}ms</p>
								<p>Total runs: {formatNumber(health.scheduler.clipCache.totalRuns)}</p>
								<p>Total failures: {formatNumber(health.scheduler.clipCache.totalFailures)}</p>
								<p>Last owner count: {formatNumber(health.scheduler.clipCache.lastRunOwnerCount)}</p>
								<p>Last duration ms: {formatNumber(health.scheduler.clipCache.lastRunDurationMs ?? 0)}</p>
								<p>Last run at: {formatDate(health.scheduler.clipCache.lastRunAt ?? null)}</p>
								<p>DB ping ms: {formatNumber(health.db.pingMs)}</p>
								<p>Health aggregation ms: {formatNumber(health.db.healthAggregationMs)}</p>
								<p>DB ok: {health.db.ok ? "yes" : "no"}</p>
								<p>Commit: {health.app.version}</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{error ? (
					<Alert status='danger'>
						<Alert.Content>
							<Alert.Description>Admin action failed: {error}</Alert.Description>
						</Alert.Content>
					</Alert>
				) : null}

				<AdminUserExplorer
					users={explorer.users.map((row) => ({
						id: row.id,
						username: row.username,
						email: row.email,
						role: row.role,
						plan: row.plan,
						lastLoginLabel: formatDate(row.lastLogin),
					}))}
					initialPage={explorer.page}
					initialTotalPages={explorer.totalPages}
					initialTotalRows={explorer.totalRows}
					initialQuery={initialQuery}
				/>
			</div>
		</DashboardNavbar>
	);
}
