export const CLIPIFY_SHOWCASE_FPS = 30;
export const CLIPIFY_SHOWCASE_DURATION_IN_FRAMES = 1350;

export const SCENE_START_FRAMES = {
	problem: 0,
	withoutClipify: 120,
	addClipify: 285,
	clipPlayback: 405,
	reward: 765,
	summary: 975,
	end: 1155,
} as const;

// Two quick groups of three losses with a deliberate pause between them.
export const VIEWER_LOSS_FRAMES = [138, 151, 164, 208, 221, 234] as const;

// Viewer growth is intentionally sparse. These are the only moments that get
// an upward chime; reaction bubbles use a softer, non-musical pop.
export const VIEWER_GAIN_FRAMES = [480, 522, 564, 606] as const;
export const RESET_VIEWER_GAIN_FRAMES = [365, 370, 376, 383, 391, 400] as const;
export const POSITIVE_REACTION_FRAMES = [452, 466, 487, 510, 529, 546, 574, 594, 618, 641, 658, 681, 704, 734] as const;
export const CLIP_CHAT_REVEAL_FRAMES = [440, 505, 585, 665, 725] as const;
export const ADD_CLIPIFY_CLICK_FRAME = 313;
export const BOMB_IMPACT_FRAME = 363;
export const CHANNEL_POINTS_CLICK_FRAME = 805;
export const REWARD_CLICK_FRAME = 847;
export const REWARD_IMPACT_FRAME = 858;
export const REWARD_REACTION_FRAMES = [869, 891, 913, 935, 957] as const;
export const FEATURE_CARD_FRAMES = [997, 1013, 1029] as const;
export const END_RESOLVE_FRAME = 1160;

export const localFrame = (globalFrame: number, sceneStart: number) => globalFrame - sceneStart;
