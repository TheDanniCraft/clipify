export const PLAYBACK_TIMEOUT_MESSAGE = "Playback timeout: the current clip stopped responding or exceeded the five-minute finishing limit.";
/** The generated player and native capture share this small media boundary. */
export type PlaybackClip = { id: string; time: number; duration: number; started: boolean; ended: boolean };
export type PlaybackSnapshot = { generation: string; state: "playing" | "draining" | "drained"; clips: PlaybackClip[]; pendingClipIds: string[] };
export type PlaybackDrain = ReturnType<typeof createPlaybackDrain>;
export function createPlaybackDrain(options: { generation: string; deadlineMonotonic?: number; now?: () => number; readClips: () => PlaybackClip[]; preventNext: () => void }) {
	let state: PlaybackSnapshot["state"] = "playing";
	const pending = new Set<string>();
	const beginDrain = () => {
		if (state !== "playing") return;
		for (const clip of options.readClips()) if (clip.started && !clip.ended) pending.add(clip.id);
		state = pending.size ? "draining" : "drained";
		options.preventNext();
	};
	const checkDeadline = () => {
		if (state !== "playing" || options.deadlineMonotonic === undefined) return;
		const now = options.now?.() ?? performance.now();
		if (!Number.isFinite(now) || !Number.isFinite(options.deadlineMonotonic) || now >= options.deadlineMonotonic) beginDrain();
	};
	const snapshot = (): PlaybackSnapshot => {
		checkDeadline();
		return { generation: options.generation, state, clips: options.readClips(), pendingClipIds: [...pending] };
	};
	return {
		snapshot,
		canAdvance: () => {
			checkDeadline();
			return state === "playing";
		},
		updateDeadline(generation: string, deadlineMonotonic: number) {
			if (generation !== options.generation || state !== "playing") return snapshot();
			if (!Number.isFinite(deadlineMonotonic)) beginDrain();
			else options.deadlineMonotonic = deadlineMonotonic;
			return snapshot();
		},
		requestDrain(generation: string) {
			if (generation !== options.generation || state !== "playing") return snapshot();
			beginDrain();
			return snapshot();
		},
		notifyEnded(id: string) {
			if (state !== "draining") return;
			pending.delete(id);
			if (!pending.size) state = "drained";
		},
	};
}
declare global {
	interface Window {
		clipifyRunnerPresentation?: PlaybackDrain;
		__clipifyRunnerExecution?: { generation: string; deadlineMonotonic?: number };
	}
}
