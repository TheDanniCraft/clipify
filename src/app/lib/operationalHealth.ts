/* istanbul ignore file */
import * as Sentry from "@sentry/nextjs";
import { db } from "@/db/client";
import { modQueueTable, queueTable, runnersTable, streamSessionsTable } from "@/db/schema";
import { count, min, sql } from "drizzle-orm";
import { RunnerStatus, StreamState } from "@types";

const PUBLISH_INTERVAL_MS = 60_000;
const HEARTBEAT_FRESH_MS = 10_000;
const QUEUE_STALL_MS = 2 * 60_000;
const PLAYBACK_ISSUE_ACTIVE_MS = 2 * 60_000;
const PLAYBACK_OUTCOMES = new Set(["play_recovered", "reload_recovered", "advanced", "advance_failed", "recovery_error", "cancelled"]);

type OperationalEnvironment = "production" | "preview" | "development" | "test";
type OverlayHealthState = "connected" | "waiting_for_player" | "healthy" | "recovering" | "stalled" | "paused" | "standby";
type QueueHealthState = "dormant" | "active" | "draining" | "stalled";
type MetricAttributes = Record<string, string | number | boolean>;
type MetricBucket = { name: string; value: number; attributes: MetricAttributes };
type DurationBucket = MetricBucket & { samples: number; maximum: number };

type OverlayRuntime = {
	overlayId: string;
	ownerId: string;
	connectedAt: number;
	lastHeartbeatAt: number | null;
	lastProgressAt: number | null;
	lastCurrentTime: number | null;
	currentClipId: string | null;
	playerAttached: boolean;
	showPlayer: boolean;
	paused: boolean;
	standby: boolean;
	lastIssueAt: number | null;
	lastIssueOutcome: string | null;
	lastReportedState: OverlayHealthState | null;
};

type ConnectionRuntime = {
	overlayId: string;
	ownerId: string;
	role: "overlay" | "controller";
};

type QueueObservation = {
	depth: number;
	lastProgressAt: number;
};

type RuntimeStore = {
	connections: Map<object, ConnectionRuntime>;
	overlays: Map<string, OverlayRuntime>;
	counters: Map<string, MetricBucket>;
	gauges: Map<string, MetricBucket>;
	durations: Map<string, DurationBucket>;
	queueObservations: Map<string, QueueObservation>;
};

declare global {
	var __operationalHealthStore: RuntimeStore | undefined;
	var __operationalHealthPublisherStarted: boolean | undefined;
	var __operationalHealthPublisherRunning: boolean | undefined;
	var __operationalHealthPublisherTimer: ReturnType<typeof setInterval> | undefined;
}

function getStore(): RuntimeStore {
	return (
		globalThis.__operationalHealthStore ??
		(globalThis.__operationalHealthStore = {
			connections: new Map(),
			overlays: new Map(),
			counters: new Map(),
			gauges: new Map(),
			durations: new Map(),
			queueObservations: new Map(),
		})
	);
}

export function getOperationalEnvironment(): OperationalEnvironment {
	if (process.env.NODE_ENV === "test") return "test";
	if (process.env.IS_PREVIEW === "true") return "preview";
	return process.env.NODE_ENV === "production" ? "production" : "development";
}

function attributesKey(attributes: MetricAttributes) {
	return JSON.stringify(Object.entries(attributes).sort(([left], [right]) => left.localeCompare(right)));
}

function metricKey(name: string, attributes: MetricAttributes) {
	return `${name}:${attributesKey(attributes)}`;
}

export function operationalCount(name: string, value = 1, attributes: MetricAttributes = {}) {
	const store = getStore();
	const key = metricKey(name, attributes);
	const current = store.counters.get(key);
	if (current) current.value += value;
	else store.counters.set(key, { name, value, attributes });
}

export function operationalGauge(name: string, value: number, attributes: MetricAttributes = {}) {
	if (!Number.isFinite(value)) return;
	const store = getStore();
	store.gauges.set(metricKey(name, attributes), { name, value, attributes });
}

export function operationalDuration(name: string, valueMs: number, attributes: MetricAttributes = {}) {
	if (!Number.isFinite(valueMs) || valueMs < 0) return;
	const store = getStore();
	const key = metricKey(name, attributes);
	const current = store.durations.get(key);
	if (current) {
		current.value += valueMs;
		current.samples += 1;
		current.maximum = Math.max(current.maximum, valueMs);
	} else {
		store.durations.set(key, { name, value: valueMs, samples: 1, maximum: valueMs, attributes });
	}
}

function writeTransitionLog(message: string, attributes: MetricAttributes, level: "info" | "warn" = "info") {
	if (getOperationalEnvironment() === "production") {
		Sentry.logger[level](message, attributes);
		return;
	}
	if (getOperationalEnvironment() !== "test") console.info(`[OperationalHealth] ${message}`, attributes);
}

function createOverlayRuntime(overlayId: string, ownerId: string, now: number): OverlayRuntime {
	return {
		overlayId,
		ownerId,
		connectedAt: now,
		lastHeartbeatAt: null,
		lastProgressAt: null,
		lastCurrentTime: null,
		currentClipId: null,
		playerAttached: false,
		showPlayer: false,
		paused: false,
		standby: false,
		lastIssueAt: null,
		lastIssueOutcome: null,
		lastReportedState: null,
	};
}

function isFresh(runtime: OverlayRuntime, now: number) {
	return runtime.lastHeartbeatAt !== null && now - runtime.lastHeartbeatAt <= HEARTBEAT_FRESH_MS;
}

function isEligible(runtime: OverlayRuntime, now: number) {
	return isFresh(runtime, now) && runtime.playerAttached && runtime.showPlayer && !runtime.paused && !runtime.standby;
}

function playbackIssueFailed(runtime: OverlayRuntime, now: number) {
	if (runtime.lastIssueAt === null || now - runtime.lastIssueAt > PLAYBACK_ISSUE_ACTIVE_MS) return false;
	return runtime.lastIssueOutcome === "advance_failed" || runtime.lastIssueOutcome === "recovery_error";
}

export function classifyOverlayHealth(runtime: OverlayRuntime, now = Date.now()): OverlayHealthState {
	if (runtime.standby) return "standby";
	if (runtime.paused) return "paused";
	if (!isEligible(runtime, now)) return "connected";
	if (!runtime.currentClipId) return "waiting_for_player";
	if (playbackIssueFailed(runtime, now)) return "stalled";
	if (runtime.lastIssueAt !== null && runtime.lastProgressAt !== null && runtime.lastProgressAt < runtime.lastIssueAt && now - runtime.lastIssueAt <= PLAYBACK_ISSUE_ACTIVE_MS) return "recovering";
	return "healthy";
}

function emitOverlayTransition(runtime: OverlayRuntime, now: number) {
	const next = classifyOverlayHealth(runtime, now);
	const previous = runtime.lastReportedState;
	if (previous === next) return;
	runtime.lastReportedState = next;
	operationalCount("clipify.overlay.state_transitions", 1, { from: previous ?? "new", to: next });
	writeTransitionLog("Overlay health state changed", { from: previous ?? "new", to: next }, next === "stalled" ? "warn" : "info");
}

export function recordWebSocketSubscribed(client: object, overlayId: string, ownerId: string, role: "overlay" | "controller", now = Date.now()) {
	const store = getStore();
	store.connections.set(client, { overlayId, ownerId, role });
	operationalCount("clipify.websocket.subscriptions", 1, { role, outcome: "accepted" });
	if (role !== "overlay") return;
	const runtime = store.overlays.get(overlayId) ?? createOverlayRuntime(overlayId, ownerId, now);
	runtime.ownerId = ownerId;
	store.overlays.set(overlayId, runtime);
	emitOverlayTransition(runtime, now);
}

export function recordWebSocketRejected(reason: "invalid_message" | "invalid_subscription" | "unauthorized" | "subscribe_timeout") {
	operationalCount("clipify.websocket.rejections", 1, { reason });
}

export function recordWebSocketDisconnected(client: object) {
	const store = getStore();
	const connection = store.connections.get(client);
	if (!connection) return;
	store.connections.delete(client);
	operationalCount("clipify.websocket.disconnects", 1, { role: connection.role });
	if (connection.role !== "overlay") return;
	const hasAnotherOverlayConnection = [...store.connections.values()].some((entry) => entry.role === "overlay" && entry.overlayId === connection.overlayId);
	if (!hasAnotherOverlayConnection) {
		const runtime = store.overlays.get(connection.overlayId);
		if (runtime?.lastReportedState) writeTransitionLog("Overlay health state changed", { from: runtime.lastReportedState, to: "disconnected" });
		store.overlays.delete(connection.overlayId);
	}
}

function stringOrNull(value: unknown) {
	return typeof value === "string" && value.length > 0 ? value : null;
}

function playbackOutcome(value: unknown) {
	const outcome = stringOrNull(value);
	return outcome && PLAYBACK_OUTCOMES.has(outcome) ? outcome : "unknown";
}

export function recordOverlayStateUpdate(client: object, payload: Record<string, unknown>, now = Date.now()) {
	const store = getStore();
	const connection = store.connections.get(client);
	if (!connection || connection.role !== "overlay") return;
	const runtime = store.overlays.get(connection.overlayId) ?? createOverlayRuntime(connection.overlayId, connection.ownerId, now);
	const kind = payload.kind;

	if (kind === "heartbeat") {
		runtime.lastHeartbeatAt = now;
		runtime.playerAttached = payload.playerAttached === true;
		if (typeof payload.showPlayer === "boolean") runtime.showPlayer = payload.showPlayer;
		if (typeof payload.paused === "boolean") runtime.paused = payload.paused;
		if (typeof payload.standby === "boolean") runtime.standby = payload.standby;
		const heartbeatClipId = stringOrNull(payload.currentClipId);
		if (heartbeatClipId !== runtime.currentClipId) {
			runtime.currentClipId = heartbeatClipId;
			runtime.lastCurrentTime = null;
			runtime.lastProgressAt = now;
		}
	} else if (kind === "playback_state") {
		if (typeof payload.showPlayer === "boolean") runtime.showPlayer = payload.showPlayer;
		if (typeof payload.paused === "boolean") runtime.paused = payload.paused;
	} else if (kind === "now_playing") {
		const clipId = stringOrNull(payload.clipId);
		const currentTime = typeof payload.currentTime === "number" && Number.isFinite(payload.currentTime) ? payload.currentTime : null;
		if (clipId !== runtime.currentClipId) {
			runtime.currentClipId = clipId;
			runtime.lastCurrentTime = currentTime;
			runtime.lastProgressAt = now;
			if (clipId) operationalCount("clipify.playback.clip_changes", 1);
		} else if (currentTime !== null && (runtime.lastCurrentTime === null || currentTime >= runtime.lastCurrentTime + 0.05)) {
			runtime.lastCurrentTime = currentTime;
			runtime.lastProgressAt = now;
		}
	} else if (kind === "playback_issue") {
		const outcome = playbackOutcome(payload.outcome);
		runtime.lastIssueAt = now;
		runtime.lastIssueOutcome = outcome;
		operationalCount("clipify.playback.recovery_results", 1, { outcome });
	}

	store.overlays.set(connection.overlayId, runtime);
	emitOverlayTransition(runtime, now);
}

type QueueRow = { key: string; depth: number; oldestQueuedAt: Date | string | null };

function classifyQueue(key: string, depth: number, eligible: boolean, progressAt: number | null, now: number): QueueHealthState {
	const store = getStore();
	const previous = store.queueObservations.get(key);
	if (!eligible) {
		store.queueObservations.set(key, { depth, lastProgressAt: now });
		return "dormant";
	}
	if (depth === 0) {
		store.queueObservations.set(key, { depth, lastProgressAt: now });
		return "active";
	}
	const madeProgress = Boolean((previous && depth < previous.depth) || (progressAt !== null && (!previous || progressAt > previous.lastProgressAt)));
	const lastProgressAt = madeProgress ? now : (previous?.lastProgressAt ?? now);
	store.queueObservations.set(key, { depth, lastProgressAt });
	if (madeProgress && previous && depth < previous.depth) return "draining";
	return now - lastProgressAt >= QUEUE_STALL_MS ? "stalled" : "active";
}

async function collectDatabaseHealth() {
	const [viewerRows, moderatorRows, runnerRows, streamRows] = await Promise.all([
		db
			.select({ key: queueTable.overlayId, depth: count(), oldestQueuedAt: min(queueTable.queuedAt) })
			.from(queueTable)
			.groupBy(queueTable.overlayId),
		db
			.select({ key: modQueueTable.broadcasterId, depth: count(), oldestQueuedAt: min(modQueueTable.queuedAt) })
			.from(modQueueTable)
			.groupBy(modQueueTable.broadcasterId),
		db.select({ total: count(), online: sql<number>`count(*) filter (where ${runnersTable.status} = ${RunnerStatus.Online})` }).from(runnersTable),
		db.select({ total: count(), desiredRunning: sql<number>`count(*) filter (where ${streamSessionsTable.desiredState} = ${StreamState.Running})`, actuallyRunning: sql<number>`count(*) filter (where ${streamSessionsTable.actualState} = ${StreamState.Running})`, errored: sql<number>`count(*) filter (where ${streamSessionsTable.actualState} = ${StreamState.Error})` }).from(streamSessionsTable),
	]);
	return {
		viewerRows: viewerRows.map((row) => ({ ...row, depth: Number(row.depth ?? 0) })) as QueueRow[],
		moderatorRows: moderatorRows.map((row) => ({ ...row, depth: Number(row.depth ?? 0) })) as QueueRow[],
		runners: { total: Number(runnerRows[0]?.total ?? 0), online: Number(runnerRows[0]?.online ?? 0) },
		streams: {
			total: Number(streamRows[0]?.total ?? 0),
			desiredRunning: Number(streamRows[0]?.desiredRunning ?? 0),
			actuallyRunning: Number(streamRows[0]?.actuallyRunning ?? 0),
			errored: Number(streamRows[0]?.errored ?? 0),
		},
	};
}

function queueSummary(rows: QueueRow[], type: "viewer" | "moderator", eligibleByKey: Map<string, OverlayRuntime>, now: number) {
	const summary: Record<QueueHealthState, { consumers: number; depth: number; oldestAgeSeconds: number }> = {
		dormant: { consumers: 0, depth: 0, oldestAgeSeconds: 0 },
		active: { consumers: 0, depth: 0, oldestAgeSeconds: 0 },
		draining: { consumers: 0, depth: 0, oldestAgeSeconds: 0 },
		stalled: { consumers: 0, depth: 0, oldestAgeSeconds: 0 },
	};
	for (const row of rows) {
		const runtime = eligibleByKey.get(row.key);
		const state = classifyQueue(`${type}:${row.key}`, row.depth, Boolean(runtime), runtime?.lastProgressAt ?? null, now);
		const queuedAt = row.oldestQueuedAt instanceof Date ? row.oldestQueuedAt.getTime() : typeof row.oldestQueuedAt === "string" ? Date.parse(row.oldestQueuedAt) : Number.NaN;
		summary[state].consumers += 1;
		summary[state].depth += row.depth;
		if (Number.isFinite(queuedAt)) summary[state].oldestAgeSeconds = Math.max(summary[state].oldestAgeSeconds, Math.max(0, (now - queuedAt) / 1000));
	}
	return summary;
}

function drainBufferedMetrics() {
	const store = getStore();
	const counters = [...store.counters.values()];
	const gauges = [...store.gauges.values()];
	const durations = [...store.durations.values()];
	store.counters.clear();
	store.gauges.clear();
	store.durations.clear();
	return { counters, gauges, durations };
}

export async function publishOperationalHealthSnapshot(now = Date.now()) {
	const started = Date.now();
	const store = getStore();
	const database = await collectDatabaseHealth();
	const overlayStates = new Map<OverlayHealthState, number>();
	const eligibleOverlays = new Map<string, OverlayRuntime>();
	const eligibleOwners = new Map<string, OverlayRuntime>();

	for (const runtime of store.overlays.values()) {
		emitOverlayTransition(runtime, now);
		const state = classifyOverlayHealth(runtime, now);
		overlayStates.set(state, (overlayStates.get(state) ?? 0) + 1);
		if (isEligible(runtime, now)) {
			eligibleOverlays.set(runtime.overlayId, runtime);
			eligibleOwners.set(runtime.ownerId, runtime);
		}
	}

	const viewerQueues = queueSummary(database.viewerRows, "viewer", eligibleOverlays, now);
	const moderatorQueues = queueSummary(database.moderatorRows, "moderator", eligibleOwners, now);
	const connections = { overlay: 0, controller: 0 };
	for (const connection of store.connections.values()) connections[connection.role] += 1;
	const buffered = drainBufferedMetrics();
	const snapshot = {
		timestamp: new Date(now).toISOString(),
		environment: getOperationalEnvironment(),
		connections,
		overlays: {
			eligible: eligibleOverlays.size,
			states: Object.fromEntries(overlayStates),
		},
		queues: { viewer: viewerQueues, moderator: moderatorQueues },
		runners: database.runners,
		streams: database.streams,
		buffered,
		collectionDurationMs: Date.now() - started,
	};

	if (getOperationalEnvironment() !== "production") {
		if (getOperationalEnvironment() !== "test") console.info("[OperationalHealth] minute snapshot", JSON.stringify(snapshot));
		return snapshot;
	}

	for (const [role, value] of Object.entries(connections)) Sentry.metrics.gauge("clipify.websocket.connections", value, { attributes: { role } });
	Sentry.metrics.gauge("clipify.overlay.eligible", eligibleOverlays.size);
	for (const state of ["connected", "waiting_for_player", "healthy", "recovering", "stalled", "paused", "standby"] as const) {
		Sentry.metrics.gauge("clipify.overlay.states", overlayStates.get(state) ?? 0, { attributes: { state } });
	}
	for (const [queueType, queue] of Object.entries({ viewer: viewerQueues, moderator: moderatorQueues })) {
		for (const [state, values] of Object.entries(queue)) {
			Sentry.metrics.gauge("clipify.queue.consumers", values.consumers, { attributes: { queue: queueType, state } });
			Sentry.metrics.gauge("clipify.queue.depth", values.depth, { attributes: { queue: queueType, state } });
			Sentry.metrics.gauge("clipify.queue.oldest_age", values.oldestAgeSeconds, { unit: "second", attributes: { queue: queueType, state } });
		}
	}
	Sentry.metrics.gauge("clipify.runner.nodes", database.runners.total, { attributes: { state: "total" } });
	Sentry.metrics.gauge("clipify.runner.nodes", database.runners.online, { attributes: { state: "online" } });
	for (const [state, value] of Object.entries(database.streams)) Sentry.metrics.gauge("clipify.runner.streams", value, { attributes: { state } });
	for (const metric of buffered.counters) Sentry.metrics.count(metric.name, metric.value, { attributes: metric.attributes });
	for (const metric of buffered.gauges) Sentry.metrics.gauge(metric.name, metric.value, { attributes: metric.attributes });
	for (const metric of buffered.durations) {
		Sentry.metrics.distribution(metric.name, metric.value / metric.samples, { unit: "millisecond", attributes: { ...metric.attributes, aggregation: "average" } });
		Sentry.metrics.gauge(`${metric.name}.max`, metric.maximum, { unit: "millisecond", attributes: metric.attributes });
	}
	Sentry.metrics.distribution("clipify.health.collection_duration", snapshot.collectionDurationMs, { unit: "millisecond" });
	return snapshot;
}

export function startOperationalHealthPublisher() {
	if (process.env.NEXT_PHASE === "phase-production-build" || process.env.NODE_ENV === "test" || globalThis.__operationalHealthPublisherStarted) return;
	globalThis.__operationalHealthPublisherStarted = true;
	const run = async () => {
		if (globalThis.__operationalHealthPublisherRunning) return;
		globalThis.__operationalHealthPublisherRunning = true;
		try {
			await publishOperationalHealthSnapshot();
		} catch (error) {
			if (getOperationalEnvironment() === "production") {
				Sentry.captureException(error, { tags: { component: "operational-health", operation: "publish" } });
			} else {
				console.info("[OperationalHealth] snapshot collection failed", error instanceof Error ? error.message : String(error));
			}
		} finally {
			globalThis.__operationalHealthPublisherRunning = false;
		}
	};
	void run();
	globalThis.__operationalHealthPublisherTimer = setInterval(() => void run(), PUBLISH_INTERVAL_MS);
	globalThis.__operationalHealthPublisherTimer.unref?.();
}

export function resetOperationalHealthForTests() {
	globalThis.__operationalHealthStore = undefined;
	globalThis.__operationalHealthPublisherStarted = undefined;
	globalThis.__operationalHealthPublisherRunning = undefined;
	if (globalThis.__operationalHealthPublisherTimer) clearInterval(globalThis.__operationalHealthPublisherTimer);
	globalThis.__operationalHealthPublisherTimer = undefined;
}
