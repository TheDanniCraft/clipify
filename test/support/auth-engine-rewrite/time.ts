export const RECENT_AUTH_WINDOW_MS = 5 * 60 * 1000;

export class ControlledClock {
	#now: number;

	constructor(now: Date | string | number = "2026-09-27T12:00:00.000Z") {
		this.#now = new Date(now).getTime();
	}

	now = (): Date => new Date(this.#now);

	advance(milliseconds: number): Date {
		if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new Error("Clock advances must be finite and non-negative");
		this.#now += milliseconds;
		return this.now();
	}

	set(value: Date | string | number): Date {
		this.#now = new Date(value).getTime();
		return this.now();
	}
}

export function createDeterministicTokenGenerator(prefix = "token") {
	let sequence = 0;
	return () => `${prefix}-${String(++sequence).padStart(6, "0")}`;
}

export function createDeterministicBytes(seed = 1) {
	let state = seed >>> 0;
	return (length: number): Uint8Array => {
		const bytes = new Uint8Array(length);
		for (let index = 0; index < length; index += 1) {
			state = (state * 1664525 + 1013904223) >>> 0;
			bytes[index] = state & 0xff;
		}
		return bytes;
	};
}

export function leaseBoundary(clock: ControlledClock, durationMs: number) {
	const claimedAt = clock.now();
	return { claimedAt, expiresAt: new Date(claimedAt.getTime() + durationMs) };
}

export function recentAuthBoundary(now: Date, windowMs = RECENT_AUTH_WINDOW_MS) {
	return {
		inside: new Date(now.getTime() - windowMs + 1),
		exact: new Date(now.getTime() - windowMs),
		outside: new Date(now.getTime() - windowMs - 1),
	};
}
