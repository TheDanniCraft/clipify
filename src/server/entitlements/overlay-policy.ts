import { MaxDurationMode, OverlayType, PlaybackMode, type Overlay } from "@types";

export const FREE_OVERLAY_RUNTIME_PATCH = {
	rewardId: null,
	minClipDuration: 0,
	maxClipDuration: 60,
	maxDurationMode: MaxDurationMode.Filter,
	blacklistWords: [],
	categoriesOnly: [],
	categoriesBlocked: [],
	playbackMode: PlaybackMode.Random,
	preferCurrentCategory: false,
	clipCreatorsOnly: [],
	clipCreatorsBlocked: [],
	clipPackSize: 100,
	playerVolume: 50,
	showChannelInfo: true,
	showClipInfo: true,
	showTimer: false,
	showProgressBar: false,
	overlayInfoFadeOutSeconds: 6,
	themeFontFamily: "inherit",
	themeTextColor: "#FFFFFF",
	themeAccentColor: "#7C3AED",
	themeBackgroundColor: "rgba(10,10,10,0.65)",
	progressBarStartColor: "#26018E",
	progressBarEndColor: "#8D42F9",
	borderSize: 0,
	borderRadius: 10,
	effectScanlines: false,
	effectStatic: false,
	effectCrt: false,
	channelInfoX: 0,
	channelInfoY: 0,
	clipInfoX: 100,
	clipInfoY: 100,
	timerX: 100,
	timerY: 0,
	channelScale: 100,
	clipScale: 100,
	timerScale: 100,
} satisfies Partial<Overlay>;

/**
 * Returns the effective Free runtime configuration without mutating the saved
 * Pro configuration. Restoring Pro therefore restores the creator's settings.
 */
export function applyFreeOverlayRuntimePolicy(overlay: Overlay): Overlay {
	return {
		...overlay,
		...FREE_OVERLAY_RUNTIME_PATCH,
		// Playlist remains a Free overlay mode; only paid playback behavior is
		// normalized here. A disallowed retained playlist is detached separately.
		playlistId: overlay.type === OverlayType.Playlist ? overlay.playlistId : null,
	};
}
