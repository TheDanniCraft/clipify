export function controlledRunnerClock(initial = "2026-10-14T12:00:00.000Z") {
	let instant = new Date(initial).getTime();
	if (!Number.isFinite(instant)) throw new Error("Invalid fixture clock");
	return {
		now: () => new Date(instant),
		advance: (milliseconds: number) => {
			if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new Error("Invalid clock advancement");
			instant += milliseconds;
		},
		set: (value: string | Date) => {
			const next = new Date(value).getTime();
			if (!Number.isFinite(next)) throw new Error("Invalid fixture clock");
			instant = next;
		},
	};
}
export function shortRunnerClip(id = "fixture-clip", durationSeconds = 2) {
	return { id, durationSeconds, title: "Generated fixture clip", width: 320, height: 180, fps: 15 };
}
