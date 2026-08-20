"use client";

import { useCallback, useEffect, useRef } from "react";

export const QUALIFIED_PLAYBACK_MS = 5_000;

type PlaybackState = {
	playedMs: number;
	startedAt: number | null;
	timer: ReturnType<typeof setTimeout> | null;
	qualified: boolean;
};

const initialState = (): PlaybackState => ({ playedMs: 0, startedAt: null, timer: null, qualified: false });

export function useQualifiedPlayback(resourceKey: string, onQualified: () => void, thresholdMs = QUALIFIED_PLAYBACK_MS) {
	const callbackRef = useRef(onQualified);
	const stateRef = useRef<PlaybackState>(initialState());
	useEffect(() => {
		callbackRef.current = onQualified;
	}, [onQualified]);

	const stop = useCallback(() => {
		const state = stateRef.current;
		if (state.startedAt !== null) {
			state.playedMs += Math.max(0, performance.now() - state.startedAt);
			state.startedAt = null;
		}
		if (state.timer !== null) {
			clearTimeout(state.timer);
			state.timer = null;
		}
	}, []);

	const start = useCallback(() => {
		const state = stateRef.current;
		if (state.qualified || state.startedAt !== null) return;
		const remainingMs = Math.max(0, thresholdMs - state.playedMs);
		state.startedAt = performance.now();
		state.timer = setTimeout(() => {
			const current = stateRef.current;
			current.playedMs = thresholdMs;
			current.startedAt = null;
			current.timer = null;
			current.qualified = true;
			callbackRef.current();
		}, remainingMs);
	}, [thresholdMs]);

	useEffect(() => {
		stateRef.current = initialState();
		return () => {
			const timer = stateRef.current.timer;
			if (timer !== null) clearTimeout(timer);
		};
	}, [resourceKey]);

	return { onPlaying: start, onPause: stop, onWaiting: stop, onEnded: stop };
}
