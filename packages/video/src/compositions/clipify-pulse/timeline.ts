export const CLIPIFY_PULSE_FPS = 30;
export const CLIPIFY_PULSE_DURATION_IN_FRAMES = 735;

export const PULSE_SCENE_STARTS = {
	opening: 0,
	playlist: 75,
	style: 180,
	broadcast: 285,
	controls: 390,
	momentum: 503,
	end: 630,
} as const;

export const PULSE_CUE_FRAMES = {
	openingWords: [0, 18, 38],
	playlistWhoosh: 69,
	playlistImpact: 75,
	playlistSnap: 124,
	styleWhoosh: 174,
	styleImpact: 180,
	paletteClicks: [193, 200],
	broadcastWhoosh: 279,
	broadcastImpact: 285,
	controlsWhoosh: 384,
	controlsImpact: 390,
	controlPresses: [424, 440, 456],
	momentumWords: [503, 518, 532],
	endWhoosh: 624,
	endResolve: 630,
	endCta: 655,
} as const;

export const pulseLocalFrame = (frame: number, start: number) => frame - start;
