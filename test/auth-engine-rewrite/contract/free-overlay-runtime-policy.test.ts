import { applyFreeOverlayRuntimePolicy } from "@/server/entitlements/overlay-policy";
import { MaxDurationMode, OverlayType, PlaybackMode, StatusOptions, type Overlay } from "@types";

function overlay(overrides: Partial<Overlay> = {}): Overlay {
	return {
		id: "overlay-1",
		ownerId: "creator-1",
		secret: "secret",
		name: "Main overlay",
		status: StatusOptions.Active,
		type: OverlayType.Playlist,
		playlistId: "playlist-1",
		rewardId: "reward-1",
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		lastUsedAt: null,
		minClipDuration: 12,
		maxClipDuration: 30,
		maxDurationMode: MaxDurationMode.Cut,
		minClipViews: 100,
		blacklistWords: ["blocked"],
		categoriesOnly: ["category"],
		categoriesBlocked: [],
		playbackMode: PlaybackMode.Order,
		preferCurrentCategory: true,
		clipCreatorsOnly: ["creator"],
		clipCreatorsBlocked: [],
		clipPackSize: 500,
		playerVolume: 80,
		showChannelInfo: false,
		showClipInfo: false,
		showTimer: true,
		showProgressBar: true,
		overlayInfoFadeOutSeconds: 20,
		themeFontFamily: "Inter",
		themeTextColor: "#111111",
		themeAccentColor: "#222222",
		themeBackgroundColor: "#333333",
		progressBarStartColor: "#444444",
		progressBarEndColor: "#555555",
		borderSize: 8,
		borderRadius: 24,
		effectScanlines: true,
		effectStatic: true,
		effectCrt: true,
		channelInfoX: 20,
		channelInfoY: 30,
		clipInfoX: 40,
		clipInfoY: 50,
		timerX: 60,
		timerY: 70,
		channelScale: 125,
		clipScale: 130,
		timerScale: 135,
		...overrides,
	};
}

describe("Free overlay runtime policy", () => {
	it("projects saved Pro configuration to Free defaults without mutating storage data", () => {
		const saved = overlay();
		const effective = applyFreeOverlayRuntimePolicy(saved);

		expect(effective).toMatchObject({
			id: saved.id,
			playlistId: saved.playlistId,
			rewardId: null,
			playbackMode: PlaybackMode.Random,
			playerVolume: 50,
			showTimer: false,
			themeFontFamily: "inherit",
			themeAccentColor: "#7C3AED",
			effectCrt: false,
		});
		expect(saved).toMatchObject({ rewardId: "reward-1", playbackMode: PlaybackMode.Order, playerVolume: 80, showTimer: true, themeFontFamily: "Inter", effectCrt: true });
	});

	it("detaches playlists from non-playlist overlays", () => {
		expect(applyFreeOverlayRuntimePolicy(overlay({ type: OverlayType.Featured })).playlistId).toBeNull();
	});
});
