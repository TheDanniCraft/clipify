export const TRAILER_FPS = 30;
export const TRAILER_DURATION = 960;
export const TRAILER_BPM = 150;
export const SCENES = { overview: 0, possibilities: 96, share: 144, overlay: 240, style: 432, gallery: 576, payoff: 720, end: 864 } as const;
export const TRAILER_EVENTS = {
	opening: 0,
	moments: [12, 24, 36, 48],
	group: 72,
	select: 84,
	lift: 96,
	editor: 144,
	camera: 156,
	gameplay: 180,
	title: 192,
	export: 204,
	ready: 216,
	sceneSwitch: 240,
	pool: [252, 264],
	autoNext: 288,
	redemption: 324,
	queued: 336,
	requestPlay: 384,
	styles: [432, 480, 528],
	widgetMove: 552,
	gallery: 576,
	tiles: [588, 600, 612],
	galleryOpen: 648,
	payoff: 720,
	fuel: 768,
	brand: 864,
	cta: 888,
} as const;
