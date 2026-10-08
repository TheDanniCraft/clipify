/** Editing areas mirror the app; fields belong to exactly one area. */
export const overlayFieldGroups = {
	settings: ["name", "status"],
	source: ["type", "playlistId"],
	filters: ["minClipDuration", "maxClipDuration", "maxDurationMode", "minClipViews", "blacklistWords", "categoriesOnly", "categoriesBlocked", "clipCreatorsOnly", "clipCreatorsBlocked"],
	playback: ["playbackMode", "preferCurrentCategory", "clipPackSize", "playerVolume"],
	theme: ["showChannelInfo", "showClipInfo", "showTimer", "showProgressBar", "overlayInfoFadeOutSeconds", "themeFontFamily", "themeTextColor", "themeAccentColor", "themeBackgroundColor", "progressBarStartColor", "progressBarEndColor", "borderSize", "borderRadius", "effectScanlines", "effectStatic", "effectCrt", "channelInfoX", "channelInfoY", "clipInfoX", "clipInfoY", "timerX", "timerY", "channelScale", "clipScale", "timerScale"],
} as const;
export const galleryFieldGroups = {
	settings: ["name"],
	source: ["source", "playlistId"],
	filters: ["liveSort", "liveTimeWindow", "liveCustomStart", "liveCustomEnd", "liveResultLimit", "includeCategories", "excludeCategories", "minimumViews", "minimumDuration", "maximumDuration", "titleBlacklist", "creatorAllowlist", "creatorBlocklist"],
	layout: ["layout", "gridAuto", "gridMobileColumns", "gridTabletColumns", "gridDesktopColumns", "listDensity", "carouselMobileCards", "carouselTabletCards", "carouselDesktopCards", "carouselShowNavigation", "carouselShowIndicators", "showTitle", "showCreator", "showViews", "showDuration", "showCreatedAt"],
	theme: ["theme", "accentColor", "backgroundMode", "backgroundColor", "cardSurfaceColor", "textColor", "cardRadius", "gap", "thumbnailTreatment", "modalBackdrop", "desktopModalWidth"],
} as const;
