import { uptime } from "node:os";

type Sources = { monotonic: () => number; uptime: () => number };

/** Include suspend elapsed time while never moving a permit clock backwards. */
export function createExecutionClock(sources: Sources = { monotonic: () => performance.now(), uptime: () => uptime() * 1000 }) {
	const startedAt = sources.monotonic();
	let uptimeAtStart = sources.uptime(),
		lastUptime = uptimeAtStart,
		lastMonotonic = startedAt,
		latest = startedAt;
	return () => {
		try {
			const monotonic = sources.monotonic(),
				system = sources.uptime();
			if (!Number.isFinite(uptimeAtStart) || ![startedAt, monotonic, system].every((value) => Number.isFinite(value) && value >= 0)) return (latest = Infinity);
			if (system < lastUptime) uptimeAtStart = system - (latest - startedAt + Math.max(0, monotonic - lastMonotonic));
			lastUptime = system;
			lastMonotonic = monotonic;
			return (latest = Math.max(latest, monotonic, startedAt + system - uptimeAtStart));
		} catch {
			return (latest = Infinity);
		}
	};
}

export const executionNow = createExecutionClock();
