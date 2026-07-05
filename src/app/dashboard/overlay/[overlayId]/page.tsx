"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useParams, useRouter } from "next/navigation";
import { createPlaylist, getClipCacheStatus, getOverlay, getOverlayOwnerPlan, getPlaylistsForOwner, previewImportPlaylistClips, saveOverlay, savePlaylist, upsertPlaylistClips } from "@actions/database";
import { Alert, Button, Card, Checkbox, Chip, ComboBox, Separator, Form, Input, Link, ListBox, Modal, NumberField, Select, Slider, Spinner, Switch, Table, Tooltip, useOverlayState, TextField, Label, Description, FieldError, InputGroup, CloseButton } from "@heroui/react";
import { notify as addToast } from "@lib/toast";
import Image from "next/image";
import type { Selection, SortDescriptor } from "@heroui/react";

import { AuthenticatedUser, Game, Overlay, OverlayType, Plan, PlaybackMode, StatusOptions, TwitchClip, TwitchReward } from "@types";
import { IconAlertTriangle, IconArrowLeft, IconCrown, IconDeviceFloppy, IconDeviceRemote, IconDownload, IconGripVertical, IconInfoCircle, IconPaint, IconPlayerPauseFilled, IconPlayerPlayFilled, IconPlus, IconSearch, IconTrash } from "@tabler/icons-react";
import DashboardNavbar from "@components/dashboardNavbar";
import FullscreenLoadingState from "@components/fullscreenLoadingState";
import { useNavigationGuard } from "next-navigation-guard";
import { validateAuth } from "@actions/auth";
import { createChannelReward, getCachedClipsByOwner, getGameDetails, getReward, getTwitchClips, getTwitchGames, removeChannelReward } from "@actions/twitch";
import { REWARD_NOT_FOUND } from "@lib/twitchErrors";
import FeedbackWidget from "@components/feedbackWidget";
import TagsInput from "@components/tagsInput";
import { isTitleBlocked } from "@/app/utils/regexFilter";
import UpgradeModal from "@components/upgradeModal";
import ChatwootData from "@components/chatwootData";
import ControlledModal from "@components/controlledModal";
import AppDateRangePicker from "@components/appDateRangePicker";
import CodeSnippet from "@components/codeSnippet";
import { getTrialDaysLeft, isReverseTrialActive } from "@lib/featureAccess";
import { usePlausible } from "next-plausible";
import { trackPaywallEvent } from "@lib/paywallTracking";
import { parseDate } from "@internationalized/date";

const overlayTypes: { key: OverlayType; label: string }[] = [
	{ key: OverlayType.Today, label: "Top Clips - Today" },
	{ key: OverlayType.LastWeek, label: "Top Clips - Last 7 Days" },
	{ key: OverlayType.LastMonth, label: "Top Clips - Last 30 Days" },
	{ key: OverlayType.LastQuarter, label: "Top Clips - Last 90 Days" },
	{ key: OverlayType.Last180Days, label: "Top Clips - Last 180 Days" },
	{ key: OverlayType.LastYear, label: "Top Clips - Last Year" },
	{ key: OverlayType.Featured, label: "Featured only" },
	{ key: OverlayType.All, label: "All Clips" },
	{ key: OverlayType.Playlist, label: "Playlist" },
	{ key: OverlayType.Queue, label: "Clip Queue" },
];

const ALL_CATEGORIES_OPTION: Game = {
	id: "all",
	name: "All categories",
	box_art_url: "",
	igdb_id: "",
};
const FREE_PLAYLIST_CLIP_LIMIT = 50;
const DEFAULT_IMPORT_START_DATE = "2016-01-01";
const normalizeCategorySearch = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

const playbackModes: { key: PlaybackMode; label: string }[] = [
	{ key: PlaybackMode.Random, label: "Random" },
	{ key: PlaybackMode.Order, label: "Order (Playlist Sequence)" },
	{ key: PlaybackMode.Top, label: "Top (Most Viewed First)" },
	{ key: PlaybackMode.SmartShuffle, label: "Smart Shuffle" },
];

const playbackModeHelpText: Record<PlaybackMode, string> = {
	[PlaybackMode.Random]: "Plays a randomized clip order from the filtered pool.",
	[PlaybackMode.Order]: "Plays clips in the saved playlist order.",
	[PlaybackMode.Top]: "Plays highest-viewed clips first. Great for strongest highlights.",
	[PlaybackMode.SmartShuffle]: "Smart Shuffle ranks clips by quality (views), then picks with weighted randomness. It temporarily downranks clip authors/categories that appeared recently, occasionally promotes lower-view clips for variety, and avoids repeating the same pattern over and over.",
};

export default function OverlaySettings() {
	const router = useRouter();
	const { overlayId } = useParams() as { overlayId: string };

	const [overlay, setOverlay] = useState<Overlay | null>(null);
	const [baseOverlay, setBaseOverlay] = useState<Overlay | null>(null);
	const [baseUrl, setBaseUrl] = useState<string | null>(null);
	const [user, setUser] = useState<AuthenticatedUser>();
	const [reward, setReward] = useState<TwitchReward | null>(null);
	const [ownerPlan, setOwnerPlan] = useState<Plan | null>(null);
	const [previewClips, setPreviewClips] = useState<TwitchClip[]>([]);
	const [previewReviewMode, setPreviewReviewMode] = useState(true);
	const [playlists, setPlaylists] = useState<Array<{ id: string; name: string; clipCount: number }>>([]);
	const [playlistClips, setPlaylistClips] = useState<TwitchClip[]>([]);
	const [savedPlaylistClipIds, setSavedPlaylistClipIds] = useState<string[]>([]);
	const [selectedPlaylistClipIds, setSelectedPlaylistClipIds] = useState<Set<string>>(new Set());
	const [playlistNameDraft, setPlaylistNameDraft] = useState("");
	const [importStartDate, setImportStartDate] = useState(DEFAULT_IMPORT_START_DATE);
	const [importEndDate, setImportEndDate] = useState("");
	const [importCategoryId, setImportCategoryId] = useState("all");
	const [importCategoryInput, setImportCategoryInput] = useState("All categories");
	const [importMinViews, setImportMinViews] = useState(0);
	const [importMinDuration, setImportMinDuration] = useState(0);
	const [importMaxDuration, setImportMaxDuration] = useState(0);
	const [importBlacklistWords, setImportBlacklistWords] = useState<string[]>([]);
	const [importCreatorAllowlist, setImportCreatorAllowlist] = useState<string[]>([]);
	const [importCreatorDenylist, setImportCreatorDenylist] = useState<string[]>([]);
	const [pendingImportMode, setPendingImportMode] = useState<"append" | "replace" | null>(null);
	const [draggedClipId, setDraggedClipId] = useState<string | null>(null);
	const [dragOverClipId, setDragOverClipId] = useState<string | null>(null);
	const [clipCacheStatus, setClipCacheStatus] = useState<Awaited<ReturnType<typeof getClipCacheStatus>> | null>(null);
	const [cachedClips, setCachedClips] = useState<TwitchClip[]>();
	const [selectedCachedClipIds, setSelectedCachedClipIds] = useState<Selection>(new Set([]));
	const [cachedClipsFilter, setCachedClipsFilter] = useState("");
	const [cachedClipsSortDescriptor, setCachedClipsSortDescriptor] = useState<SortDescriptor>({
		column: "date",
		direction: "descending",
	});
	const [gameSearchResults, setGameSearchResults] = useState<Game[]>([]);
	const [isSearchingGames, setIsSearchingGames] = useState(false);
	const [gameDetailsById, setGameDetailsById] = useState<Record<string, Game>>({});
	const [allowlistGameSearch, setAllowlistGameSearch] = useState("");
	const [denylistGameSearch, setDenylistGameSearch] = useState("");
	const [allowlistGameResults, setAllowlistGameResults] = useState<Game[]>([]);
	const [denylistGameResults, setDenylistGameResults] = useState<Game[]>([]);
	const [isSearchingAllowlistGames, setIsSearchingAllowlistGames] = useState(false);
	const [isSearchingDenylistGames, setIsSearchingDenylistGames] = useState(false);

	const { isOpen: isCliplistOpen, open: onCliplistOpen, setOpen: onCliplistOpenChange } = useOverlayState();
	const { isOpen: isPlaylistOpen, close: onPlaylistClose, setOpen: onPlaylistOpenChange } = useOverlayState();
	const { isOpen: isImportOpen, open: onImportOpen, close: onImportClose, setOpen: onImportOpenChange } = useOverlayState();
	const { isOpen: isAddClipsOpen, open: onAddClipsOpen, close: onAddClipsClose, setOpen: onAddClipsOpenChange } = useOverlayState();
	const { isOpen: isUpgradeOpen, open: onUpgradeOpen, setOpen: onUpgradeOpenChange } = useOverlayState();
	const { isOpen: isAutoImportLockedOpen, open: onAutoImportLockedOpen, close: onAutoImportLockedClose, setOpen: onAutoImportLockedOpenChange } = useOverlayState();
	const plausible = usePlausible();

	const navGuard = useNavigationGuard({ enabled: isFormDirty() });

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setBaseUrl(window.location.origin);
		setImportEndDate(new Date().toISOString().slice(0, 10));
	}, []);

	const resolveGameDetails = useCallback(
		async (clips: TwitchClip[]) => {
			if (!overlay?.ownerId) return;
			const uniqueGameIds = Array.from(new Set(clips.map((clip) => clip.game_id).filter(Boolean)));
			const missingIds = uniqueGameIds.filter((id) => !gameDetailsById[id]);
			if (missingIds.length === 0) return;

			const resolved = await Promise.all(
				missingIds.map(async (id) => {
					const game = await getGameDetails(id, overlay.ownerId);
					return {
						id,
						name: game?.name ?? "Unknown category",
						box_art_url: game?.box_art_url ?? "",
						igdb_id: game?.igdb_id ?? "",
					} as Game;
				}),
			);

			setGameDetailsById((prev) => {
				const next = { ...prev };
				for (const game of resolved) next[game.id] = game;
				return next;
			});
		},
		[overlay, gameDetailsById],
	);

	useEffect(() => {
		async function resolveGameNames() {
			if (!overlay || !user) return;
			const allIds = Array.from(new Set([...(overlay.categoriesOnly ?? []), ...(overlay.categoriesBlocked ?? [])]));
			const nextResolved = { ...gameDetailsById };
			let changed = false;

			for (const id of allIds) {
				if (!nextResolved[id]) {
					const game = await getGameDetails(id, user.id);
					if (game) {
						nextResolved[id] = game;
						changed = true;
					} else {
						// Fallback to ID if name not found
						nextResolved[id] = {
							id,
							name: `Game ${id}`,
							box_art_url: "",
							igdb_id: "",
						};
						changed = true;
					}
				}
			}

			if (changed) setGameDetailsById(nextResolved);
		}
		resolveGameNames();
	}, [gameDetailsById, overlay, user]);

	useEffect(() => {
		let timeoutId: NodeJS.Timeout;
		if (allowlistGameSearch && allowlistGameSearch.length >= 1 && user?.id) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setIsSearchingAllowlistGames(true);
			timeoutId = setTimeout(async () => {
				const games = await getTwitchGames(allowlistGameSearch, user.id);
				setAllowlistGameResults(games);
				setIsSearchingAllowlistGames(false);
			}, 400);
		} else {
			setAllowlistGameResults([]);
		}
		return () => clearTimeout(timeoutId);
	}, [allowlistGameSearch, user?.id]);

	useEffect(() => {
		let timeoutId: NodeJS.Timeout;
		if (denylistGameSearch && denylistGameSearch.length >= 1 && user?.id) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setIsSearchingDenylistGames(true);
			timeoutId = setTimeout(async () => {
				const games = await getTwitchGames(denylistGameSearch, user.id);
				setDenylistGameResults(games);
				setIsSearchingDenylistGames(false);
			}, 400);
		} else {
			setDenylistGameResults([]);
		}
		return () => clearTimeout(timeoutId);
	}, [denylistGameSearch, user?.id]);

	useEffect(() => {
		let timeoutId: NodeJS.Timeout;
		const normalizedInput = importCategoryInput.trim().toLowerCase();
		if (normalizedInput.length >= 1 && normalizedInput !== "all" && normalizedInput !== "all categories" && user?.id) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setIsSearchingGames(true);
			timeoutId = setTimeout(async () => {
				const games = await getTwitchGames(importCategoryInput, user.id);
				setGameSearchResults(games);
				setIsSearchingGames(false);
			}, 300);
		} else {
			setGameSearchResults([]);
			setIsSearchingGames(false);
		}
		return () => clearTimeout(timeoutId);
	}, [importCategoryInput, user?.id]);

	const cachedCategoryOptions: Game[] = useMemo(() => Object.values(gameDetailsById).sort((a, b) => a.name.localeCompare(b.name)), [gameDetailsById]);
	const importCategoryOptions = useMemo(() => {
		const map = new Map<string, Game>();
		for (const game of cachedCategoryOptions) map.set(game.id, game);
		for (const game of gameSearchResults) map.set(game.id, game);

		const all = [ALL_CATEGORIES_OPTION, ...Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))];
		const query = importCategoryInput.trim().toLowerCase();
		if (!query || query === "all" || query === "all categories") return [ALL_CATEGORIES_OPTION];
		const normalizedQuery = normalizeCategorySearch(query);

		return all
			.filter((game) => {
				if (game.id === "all") return true;
				const gameName = game.name.toLowerCase();
				if (gameName.includes(query)) return true;
				return normalizeCategorySearch(gameName).includes(normalizedQuery);
			})
			.sort((a, b) => {
				if (a.id === "all") return -1;
				if (b.id === "all") return 1;
				const aNorm = normalizeCategorySearch(a.name);
				const bNorm = normalizeCategorySearch(b.name);
				const aExact = aNorm === normalizedQuery ? 0 : aNorm.startsWith(normalizedQuery) ? 1 : 2;
				const bExact = bNorm === normalizedQuery ? 0 : bNorm.startsWith(normalizedQuery) ? 1 : 2;
				if (aExact !== bExact) return aExact - bExact;
				return a.name.localeCompare(b.name);
			});
	}, [cachedCategoryOptions, gameSearchResults, importCategoryInput]);

	function getGameName(gameId: string) {
		const resolved = gameDetailsById[gameId]?.name?.trim();
		return resolved && resolved !== gameId ? resolved : "Unknown category";
	}

	const filteredCachedClips = useMemo(() => {
		const f = cachedClipsFilter.toLowerCase();
		return (cachedClips ?? []).filter((clip) => {
			const categoryName = getGameName(clip.game_id).toLowerCase();
			return clip.title.toLowerCase().includes(f) || clip.creator_name.toLowerCase().includes(f) || categoryName.includes(f);
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cachedClips, cachedClipsFilter, gameDetailsById]);

	const sortedCachedClips = useMemo(() => {
		const items = [...filteredCachedClips];
		const { column, direction } = cachedClipsSortDescriptor;
		const dir = direction === "descending" ? -1 : 1;
		items.sort((a, b) => {
			switch (column) {
				case "clip":
					return a.title.localeCompare(b.title) * dir;
				case "creator":
					return a.creator_name.localeCompare(b.creator_name) * dir;
				case "category":
					return getGameName(a.game_id).localeCompare(getGameName(b.game_id)) * dir;
				case "views":
					return (a.view_count - b.view_count) * dir;
				case "date":
					return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
				default:
					return 0;
			}
		});
		return items;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [filteredCachedClips, cachedClipsSortDescriptor, gameDetailsById]);

	function reorderClips(clips: TwitchClip[], fromId: string, toId: string) {
		if (fromId === toId) return clips;
		const fromIndex = clips.findIndex((entry) => entry.id === fromId);
		const toIndex = clips.findIndex((entry) => entry.id === toId);
		if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return clips;
		const next = [...clips];
		const [moved] = next.splice(fromIndex, 1);
		next.splice(toIndex, 0, moved);
		return next;
	}

	async function handleOpenAddClips() {
		if (!overlay?.ownerId) return;
		onAddClipsOpen();
		try {
			const clips = await getCachedClipsByOwner(overlay.ownerId);
			await resolveGameDetails(clips);
			setCachedClips(clips);
			const existingPlaylistClipIds = new Set(playlistClips.map((clip) => clip.id));
			const preselectedClipIds = clips.filter((clip) => existingPlaylistClipIds.has(clip.id)).map((clip) => clip.id);
			setSelectedCachedClipIds(new Set(preselectedClipIds));
		} catch (error) {
			console.error("Failed to load clips:", error);
		}
	}

	async function handleAddSelectedClips() {
		if (!currentOverlay.playlistId) return;
		const selectedIds = Array.from(selectedCachedClipIds as Set<string>);
		const clipsToAdd = (cachedClips ?? []).filter((c) => selectedIds.includes(c.id));
		if (clipsToAdd.length === 0) return;

		try {
			setPlaylistClips((prev) => {
				const nextById = new Map(prev.map((clip) => [clip.id, clip]));
				for (const clip of clipsToAdd) nextById.set(clip.id, clip);
				return Array.from(nextById.values());
			});
			setSelectedCachedClipIds(new Set([]));
			onAddClipsClose();
		} catch {
			addToast({ title: "Failed to add clips", color: "danger" });
		}
	}

	useEffect(() => {
		async function fetchOwnerPlan() {
			if (overlay?.id) {
				const owner = await getOverlayOwnerPlan(overlay.id);
				setOwnerPlan(owner);
			}
		}
		fetchOwnerPlan();
	}, [overlay?.id]);

	useEffect(() => {
		async function checkAuth() {
			const user = await validateAuth();
			if (!user) {
				router.push("/logout");
				return;
			}

			setUser(user);
		}

		checkAuth();
	}, [router]);

	useEffect(() => {
		async function fetchRewardTitle() {
			const overlayId = overlay?.id;
			const ownerId = overlay?.ownerId;
			const rewardId = overlay?.rewardId;

			if (overlayId && ownerId && rewardId) {
				try {
					const reward = await getReward(ownerId, rewardId);
					setReward(reward);
				} catch (error) {
					const isNotFound = error instanceof Error && error.message === REWARD_NOT_FOUND;
					if (isNotFound) {
						try {
							await saveOverlay(overlayId, { rewardId: null });
						} catch {
							addToast({
								title: "Failed to update reward",
								description: "The overlay was updated locally, but saving the change failed.",
								color: "danger",
							});
						}
						setOverlay((prev) => (prev ? { ...prev, rewardId: null } : prev));
						setBaseOverlay((prev) => (prev ? { ...prev, rewardId: null } : prev));
					}
					setReward(null);
				}
			} else {
				setReward(null);
			}
		}
		fetchRewardTitle();
	}, [overlay?.id, overlay?.ownerId, overlay?.rewardId]);

	useEffect(() => {
		async function fetchOverlay() {
			const fetchedOverlay = await getOverlay(overlayId);
			if (!fetchedOverlay) return;

			setOverlay(fetchedOverlay);
			setBaseOverlay(fetchedOverlay);
		}
		fetchOverlay();
	}, [overlayId]);

	useEffect(() => {
		async function fetchClipCacheCoverage() {
			if (!overlay?.ownerId) return;
			const status = await getClipCacheStatus(overlay.ownerId);
			setClipCacheStatus(status);
		}
		fetchClipCacheCoverage();
	}, [overlay?.ownerId]);

	useEffect(() => {
		async function fetchPlaylists() {
			if (!overlay?.ownerId) return;
			const rows = await getPlaylistsForOwner(overlay.ownerId);
			setPlaylists((rows ?? []).map((row) => ({ id: row.id, name: row.name, clipCount: row.clipCount })));
		}
		fetchPlaylists();
	}, [overlay?.ownerId]);

	useEffect(() => {
		async function getClipsForType() {
			if (!overlay) return;
			const clips = await getTwitchClips(overlay, overlay.type, true);
			setPreviewClips(clips);
			await resolveGameDetails(clips);
		}
		getClipsForType();
	}, [overlay, resolveGameDetails]);

	useEffect(() => {
		async function getPlaylistSnapshot() {
			if (!overlay?.playlistId) {
				setPlaylistClips([]);
				setSavedPlaylistClipIds([]);
				return;
			}
			const playlist = playlists.find((entry) => entry.id === overlay.playlistId);
			if (!playlist) {
				setPlaylistClips([]);
				setSavedPlaylistClipIds([]);
				return;
			}
			const clips = await getTwitchClips({ ...overlay, type: OverlayType.Playlist }, OverlayType.Playlist, true);
			setPlaylistClips(clips);
			setSavedPlaylistClipIds(clips.map((clip) => clip.id));
			await resolveGameDetails(clips);
		}
		getPlaylistSnapshot();
	}, [overlay, playlists, resolveGameDetails]);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setSelectedPlaylistClipIds((prev) => new Set(Array.from(prev).filter((id) => playlistClips.some((clip) => clip.id === id))));
	}, [playlistClips]);

	useEffect(() => {
		if (!overlay?.playlistId) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setPlaylistNameDraft("");
			return;
		}
		const current = playlists.find((playlist) => playlist.id === overlay.playlistId);
		setPlaylistNameDraft(current?.name ?? "");
	}, [overlay?.playlistId, playlists]);

	useEffect(() => {
		if (!overlay) return;
		const orderModeAllowed = overlay.type === OverlayType.Playlist && !!overlay.playlistId;
		if (overlay.playbackMode === PlaybackMode.Order && !orderModeAllowed) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setOverlay((prev) => (prev ? { ...prev, playbackMode: PlaybackMode.Random } : prev));
		}
	}, [overlay]);

	useEffect(() => {
		if (!user) return;
		if (!overlay) return;
		if (user.id !== overlay.ownerId) return;
		if (ownerPlan !== Plan.Free) return;
		trackPaywallEvent(plausible, "paywall_impression", {
			source: "paywall_banner",
			feature: "advanced_filters",
			plan: user.plan,
		});
	}, [ownerPlan, overlay, plausible, user]);

	if (!overlayId || !overlay) {
		return <FullscreenLoadingState message='Loading overlay' />;
	}

	function isFormDirty() {
		return JSON.stringify(overlay) !== JSON.stringify(baseOverlay);
	}

	const currentOverlay = overlay;
	const ownerHasAdvancedAccess = ownerPlan === Plan.Pro;
	const isPlaylistOverlay = currentOverlay.type === OverlayType.Playlist;
	const selectedPlaylist = playlists.find((playlist) => playlist.id === currentOverlay.playlistId) ?? null;
	const canUseAutoImport = ownerPlan === Plan.Pro;
	const isFreePlaylistLimitActive = ownerPlan === Plan.Free;
	const playlistClipUsage = playlistClips.length;
	const playlistClipUsagePercent = Math.min(100, Math.round((playlistClipUsage / FREE_PLAYLIST_CLIP_LIMIT) * 100));
	const selectedIds = Array.from(selectedCachedClipIds as Set<string>);
	const selectedNewClipCount = (cachedClips ?? []).filter((clip) => selectedIds.includes(clip.id) && !playlistClips.some((existing) => existing.id === clip.id)).length;
	const wouldExceedFreeLimit = isFreePlaylistLimitActive && playlistClipUsage + selectedNewClipCount > FREE_PLAYLIST_CLIP_LIMIT;
	const isPlaylistDraftDirty = playlistClips.map((clip) => clip.id).join(",") !== savedPlaylistClipIds.join(",");
	const isSelectedPlaylistNameDirty = selectedPlaylist ? playlistNameDraft.trim() !== selectedPlaylist.name : false;
	const canSaveManagedPlaylist = isPlaylistDraftDirty || isSelectedPlaylistNameDirty;
	const inTrial = user ? isReverseTrialActive(user) : false;
	const trialDaysLeft = user ? getTrialDaysLeft(user) : 0;
	const overlayUrl = baseUrl && overlay.secret ? `${baseUrl}/overlay/${overlayId}?secret=${overlay.secret}` : null;
	const controllerUrl = baseUrl ? `${baseUrl}/controller/${overlayId}` : null;
	const controllerEnabled = Boolean(controllerUrl && ownerPlan === Plan.Pro);

	async function refreshPlaylists() {
		const rows = await getPlaylistsForOwner(currentOverlay.ownerId);
		setPlaylists((rows ?? []).map((row) => ({ id: row.id, name: row.name, clipCount: row.clipCount })));
	}

	async function runImport(mode: "append" | "replace") {
		if (!currentOverlay.playlistId) return;
		try {
			const imported = await previewImportPlaylistClips(currentOverlay.playlistId, {
				overlayType: OverlayType.All,
				startDate: importStartDate || null,
				endDate: importEndDate || null,
				categoryId: importCategoryId || null,
				minViews: importMinViews,
				minDuration: importMinDuration,
				maxDuration: importMaxDuration,
				blacklistWords: importBlacklistWords,
				clipCreatorsOnly: importCreatorAllowlist,
				clipCreatorsBlocked: importCreatorDenylist,
			});
			if (mode === "replace") {
				setPlaylistClips(imported);
			} else {
				setPlaylistClips((prev) => {
					const nextById = new Map(prev.map((clip) => [clip.id, clip]));
					for (const clip of imported) nextById.set(clip.id, clip);
					return Array.from(nextById.values());
				});
			}
			await resolveGameDetails(imported);
			addToast({ title: `Imported ${imported.length} clips into draft`, color: "success" });
			setPendingImportMode(null);
			onImportClose();
		} catch (error) {
			addToast({
				title: "Import failed",
				description: error instanceof Error ? error.message : "Please try again.",
				color: "danger",
			});
		}
	}

	const matchesPreviewFilters = (clip: TwitchClip) => {
		if (isPlaylistOverlay) return true;
		const overMax = clip.duration > overlay.maxClipDuration;
		if (clip.duration < overlay.minClipDuration || overMax) return false;
		if (isTitleBlocked(clip.title, overlay.blacklistWords)) return false;
		if (clip.view_count < overlay.minClipViews) return false;

		const creatorName = clip.creator_name.toLowerCase();
		const creatorId = clip.creator_id.toLowerCase();
		const allowed = (overlay.clipCreatorsOnly ?? []).map((name) => name.toLowerCase());
		const blocked = (overlay.clipCreatorsBlocked ?? []).map((name) => name.toLowerCase());

		if (allowed.length > 0 && !allowed.includes(creatorName) && !allowed.includes(creatorId)) {
			return false;
		}
		if (blocked.includes(creatorName) || blocked.includes(creatorId)) {
			return false;
		}

		const allowedCategories = (overlay.categoriesOnly ?? []).map((id) => id.toLowerCase());
		if (allowedCategories.length > 0 && !allowedCategories.includes(clip.game_id.toLowerCase())) {
			return false;
		}

		const blockedCategories = (overlay.categoriesBlocked ?? []).map((id) => id.toLowerCase());
		if (blockedCategories.length > 0 && blockedCategories.includes(clip.game_id.toLowerCase())) {
			return false;
		}

		return true;
	};

	const filteredPreviewClips = isPlaylistOverlay ? previewClips : previewClips.filter(matchesPreviewFilters);
	const previewModalClips = (() => {
		if (!previewReviewMode) return filteredPreviewClips;
		if (overlay.playbackMode === PlaybackMode.Random) {
			return (
				[...filteredPreviewClips]
					// eslint-disable-next-line react-hooks/purity
					.map((clip) => ({ clip, sort: Math.random() }))
					.sort((a, b) => a.sort - b.sort)
					.map((entry) => entry.clip)
			);
		}
		if (overlay.playbackMode === PlaybackMode.Order) {
			return filteredPreviewClips;
		}
		if (overlay.playbackMode === PlaybackMode.SmartShuffle) {
			const remaining = (() => {
				if (filteredPreviewClips.length <= 12) return [...filteredPreviewClips];
				const sortedByViews = [...filteredPreviewClips].sort((a, b) => b.view_count - a.view_count || b.created_at.localeCompare(a.created_at));
				const keepCount = Math.max(12, Math.ceil(sortedByViews.length * 0.65));
				return sortedByViews.slice(0, keepCount);
			})();
			const ordered: TwitchClip[] = [];
			const recent: TwitchClip[] = [];

			while (remaining.length > 0) {
				const recentCreatorCounts = new Map<string, number>();
				const recentGameCounts = new Map<string, number>();
				for (const clip of recent.slice(-20)) {
					const creatorKey = clip.creator_id || clip.creator_name;
					recentCreatorCounts.set(creatorKey, (recentCreatorCounts.get(creatorKey) ?? 0) + 1);
					recentGameCounts.set(clip.game_id, (recentGameCounts.get(clip.game_id) ?? 0) + 1);
				}

				const sortedViews = remaining.map((clip) => clip.view_count).sort((a, b) => a - b);
				const medianViews = sortedViews.length > 0 ? sortedViews[Math.floor(sortedViews.length / 2)] : 0;
				const maxLogViews = Math.log1p(Math.max(1, ...sortedViews));

				const scored = remaining.map((clip) => {
					const creatorKey = clip.creator_id || clip.creator_name;
					const creatorPenalty = (recentCreatorCounts.get(creatorKey) ?? 0) * 0.12;
					const gamePenalty = (recentGameCounts.get(clip.game_id) ?? 0) * 0.1;
					const viewScore = Math.log1p(clip.view_count) / maxLogViews;
					const exploreBoost = clip.view_count <= medianViews ? 0.12 : 0;
					// eslint-disable-next-line react-hooks/purity
					const jitter = Math.random() * 0.25;
					const score = Math.max(0.05, 0.58 * viewScore + 0.25 * jitter + exploreBoost - creatorPenalty - gamePenalty);
					return { clip, score };
				});

				const totalWeight = scored.reduce((sum, entry) => sum + entry.score, 0);
				// eslint-disable-next-line react-hooks/purity
				let pick = Math.random() * totalWeight;
				let pickedClip = scored[0]?.clip;
				for (const entry of scored) {
					pick -= entry.score;
					if (pick <= 0) {
						pickedClip = entry.clip;
						break;
					}
				}

				if (!pickedClip) break;
				ordered.push(pickedClip);
				recent.push(pickedClip);
				const pickedIndex = remaining.findIndex((clip) => clip.id === pickedClip.id);
				if (pickedIndex >= 0) remaining.splice(pickedIndex, 1);
				else break;
			}

			return ordered;
		}

		return [...filteredPreviewClips].sort((a, b) => {
			const byViews = b.view_count - a.view_count;
			if (byViews !== 0) return byViews;
			return b.created_at.localeCompare(a.created_at);
		});
	})();

	const requiredDaysByType: Partial<Record<OverlayType, number>> = {
		[OverlayType.Today]: 1,
		[OverlayType.LastWeek]: 7,
		[OverlayType.LastMonth]: 30,
		[OverlayType.LastQuarter]: 90,
		[OverlayType.Last180Days]: 180,
		[OverlayType.LastYear]: 365,
	};
	const selectedCoverageReady = (() => {
		if (!clipCacheStatus) return true;
		if (overlay.type === OverlayType.All) return clipCacheStatus.backfillComplete;
		if (overlay.type === OverlayType.Featured || overlay.type === OverlayType.Queue || overlay.type === OverlayType.Playlist) return true;
		const requiredDays = requiredDaysByType[overlay.type];
		if (!requiredDays) return true;
		if (!clipCacheStatus.oldestClipDate) return false;
		const oldest = new Date(clipCacheStatus.oldestClipDate).getTime();
		if (!Number.isFinite(oldest)) return false;
		// eslint-disable-next-line react-hooks/purity
		const target = Date.now() - requiredDays * 24 * 60 * 60 * 1000;
		return oldest <= target;
	})();
	const showCoverageWarning = !selectedCoverageReady && overlay.type !== OverlayType.Queue && overlay.type !== OverlayType.Featured && overlay.type !== OverlayType.Playlist;

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		addToast({
			title: "Saving...",
			color: "default",
		});

		if (!overlay) return;
		await saveOverlay(overlay.id, {
			name: overlay.name,
			status: overlay.status,
			type: overlay.type,
			playlistId: overlay.playlistId,
			rewardId: overlay.rewardId,
			minClipDuration: overlay.minClipDuration,
			maxClipDuration: overlay.maxClipDuration,
			maxDurationMode: overlay.maxDurationMode,
			blacklistWords: overlay.blacklistWords,
			categoriesOnly: overlay.categoriesOnly,
			categoriesBlocked: overlay.categoriesBlocked,
			minClipViews: overlay.minClipViews,
			playbackMode: overlay.playbackMode,
			preferCurrentCategory: overlay.preferCurrentCategory,
			clipCreatorsOnly: overlay.clipCreatorsOnly,
			clipCreatorsBlocked: overlay.clipCreatorsBlocked,
			clipPackSize: overlay.clipPackSize,
			playerVolume: overlay.playerVolume,
			showChannelInfo: overlay.showChannelInfo,
			showClipInfo: overlay.showClipInfo,
			showTimer: overlay.showTimer,
			showProgressBar: overlay.showProgressBar,
			themeFontFamily: overlay.themeFontFamily,
			themeTextColor: overlay.themeTextColor,
			themeAccentColor: overlay.themeAccentColor,
			themeBackgroundColor: overlay.themeBackgroundColor,
			borderSize: overlay.borderSize,
			borderRadius: overlay.borderRadius,
			effectScanlines: overlay.effectScanlines,
			effectStatic: overlay.effectStatic,
			channelInfoX: overlay.channelInfoX,
			channelInfoY: overlay.channelInfoY,
			clipInfoX: overlay.clipInfoX,
			clipInfoY: overlay.clipInfoY,
		});
		setBaseOverlay(overlay);
		addToast({
			title: "Overlay settings saved",
			description: "Your overlay settings have been saved successfully.",
			color: "success",
		});
	}

	return (
		<>
			<ChatwootData user={user} overlay={overlay} />

			<DashboardNavbar user={user!} title='Overlay Settings' tagline='Manage your overlays'>
				<FeedbackWidget />

				<div className='flex flex-col items-center justify-center w-full p-4'>
					<Card className='w-full max-w-4xl'>
						<Card.Header className='flex w-full flex-row items-center justify-between gap-4'>
							<div className='flex min-w-0 items-center gap-3'>
								<Button
									isIconOnly
									variant='tertiary'
									onPress={() => {
										router.push(`${baseUrl}/dashboard`);
									}}
								>
									<IconArrowLeft />
								</Button>
								<h1 className='text-xl font-bold'>Overlay Settings</h1>
							</div>
							<span className='shrink-0 text-sm text-muted'>ID: {overlayId}</span>
						</Card.Header>
						<Separator />
						<Card.Content>
							<div className='flex items-center'>
								<Form className='flex w-full flex-col gap-3' onSubmit={handleSubmit}>
									<div className='flex items-center w-full space-x-2'>
										<Switch
											isSelected={overlay.status === StatusOptions.Active}
											onChange={(value) => {
												setOverlay({ ...overlay, status: value ? StatusOptions.Active : StatusOptions.Paused });
											}}
											aria-label='Set overlay status'
										>
											<Switch.Content>
												<Switch.Control>
													<Switch.Thumb>
														<Switch.Icon>{overlay.status === StatusOptions.Active ? <IconPlayerPauseFilled size={12} /> : <IconPlayerPlayFilled size={12} />}</Switch.Icon>
													</Switch.Thumb>
												</Switch.Control>
											</Switch.Content>
										</Switch>
										<div className='flex-1 overflow-hidden'>
											<CodeSnippet className='w-full max-w-full' symbol='' preClassName='overflow-hidden whitespace-nowrap'>
												{overlayUrl ?? "Missing secret. Refresh this page to generate one."}
											</CodeSnippet>
										</div>
										<Tooltip delay={0}>
											<Tooltip.Trigger>
												<Button
													isIconOnly
													variant='danger-soft'
													isDisabled={!controllerEnabled}
													aria-label='Open remote controller'
													onPress={() => {
														if (!controllerUrl || ownerPlan !== Plan.Pro) return;
														window.open(controllerUrl, "_blank", "noopener,noreferrer");
													}}
												>
													<IconDeviceRemote size={18} />
												</Button>
											</Tooltip.Trigger>
											<Tooltip.Content>{ownerPlan === Plan.Pro ? "Open remote controller" : "Remote controller is a Pro feature"}</Tooltip.Content>
										</Tooltip>
										<Button type='submit' isIconOnly isDisabled={!isFormDirty()} aria-label='Save Overlay Settings' variant='primary'>
											<IconDeviceFloppy />
										</Button>
									</div>
									<div className='flex w-full flex-col gap-2'>
										<div className='w-full flex justify-center items-center text-xs text-warning p-2 border border-warning rounded bg-warning-soft max-w-full'>
											<IconAlertTriangle size={16} className='mr-2 flex-shrink-0' />
											<span className='text-center'>
												Do not share this URL publicly. For embedding on websites, use the{" "}
												<Link className='text-xs text-warning underline underline-offset-2' href={`${baseUrl}/dashboard/embed?oid=${overlayId}`}>
													embed widget tool
												</Link>
												.
											</span>
										</div>
										<p className='text-xs text-muted text-center'>
											For OBS/Streamlabs browser sources, use <span className='font-semibold'>1920x1080</span> for best scaling.
										</p>
									</div>
									<TextField fullWidth variant='secondary' isRequired>
										<Label>Overlay Name</Label>
										<Input
											className='w-full'
											value={overlay.name}
											onChange={(event) =>
												((value) => {
													setOverlay({ ...overlay, name: value });
												})(event.target.value)
											}
										/>
										<FieldError />
									</TextField>
									<div className='flex w-full items-end gap-2'>
										<Select
											fullWidth
											isRequired
											variant='secondary'
											value={overlay.type}
											onChange={(value) => {
												const nextType = value as OverlayType;
												const fallbackPlaylistId = playlists[0]?.id ?? null;
												const nextPlaybackMode = (() => {
													if (nextType === OverlayType.Playlist) return overlay.playbackMode;
													return overlay.playbackMode === PlaybackMode.Order ? PlaybackMode.Random : overlay.playbackMode;
												})();
												setOverlay({
													...overlay,
													type: nextType,
													playlistId: nextType === OverlayType.Playlist ? (overlay.playlistId ?? fallbackPlaylistId) : null,
													playbackMode: nextPlaybackMode,
												});
											}}
										>
											<Label>Overlay Type</Label>
											<Select.Trigger>
												<Select.Value />
												<Select.Indicator />
											</Select.Trigger>
											<Select.Popover>
												<ListBox>
													{overlayTypes.map((type) => (
														<ListBox.Item key={type.key} id={type.key} textValue={type.label}>
															<Label>{type.label}</Label>
															<ListBox.ItemIndicator />
														</ListBox.Item>
													))}
												</ListBox>
											</Select.Popover>
										</Select>
										<Button isIconOnly variant='secondary' onPress={onCliplistOpen} size='lg'>
											<span>{filteredPreviewClips.length}</span>
										</Button>
									</div>
									{showCoverageWarning && (
										<Alert status='warning' className='mt-2'>
											<Alert.Indicator>
												<IconInfoCircle size={16} />
											</Alert.Indicator>
											<Alert.Content>
												<Alert.Description>{overlay.type === OverlayType.All ? "All-time crawl is still syncing. Older clips may not appear yet." : "Selected time range is not fully cached yet. Results may be incomplete until crawl catches up."}</Alert.Description>
												<Link href='/dashboard/settings'>View crawl status</Link>
											</Alert.Content>
										</Alert>
									)}

									<Separator className='my-4' />
									{ownerPlan === Plan.Free && !ownerHasAdvancedAccess && (
										<div className='w-full mb-4'>
											<Alert status='warning'>
												<Alert.Indicator>
													<IconCrown />
												</Alert.Indicator>
												<Alert.Content>
													<Alert.Title>Pro Feature Locked</Alert.Title>
													<Alert.Description>
														Unlock advanced overlay settings with <span className='font-semibold'>Pro</span>.
													</Alert.Description>
													<ul className='list-disc list-inside text-xs mt-2 ml-1'>
														<li>Multiple overlay</li>
														<li>Link custom Twitch rewards</li>
														<li>Control your overlay via chat</li>
														<li>Remote control panel for live playback</li>
														<li>Advanced clip filtering</li>
														<li>Theme studio with drag & drop layout</li>
														<li>Priority support</li>
													</ul>
													<Button
														variant='primary'
														isDisabled={user?.id !== overlay.ownerId}
														onPress={() => {
															trackPaywallEvent(plausible, "paywall_cta_click", {
																source: "paywall_banner",
																feature: "advanced_filters",
																plan: user?.plan ?? "free",
															});
															onUpgradeOpen();
														}}
														className='mt-3 w-full font-semibold'
													>
														Upgrade to Pro
													</Button>
													{user?.id !== overlay.ownerId ? (
														<p className='text-xs text-danger text-center mt-2'>Only the overlay owner can unlock Pro features.</p>
													) : (
														<div className='mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning bg-warning-soft px-3 py-2'>
															<p className='text-xs'>{inTrial ? `Trial active: ${trialDaysLeft <= 1 ? "ends today." : `${trialDaysLeft} days left.`}` : "Start Pro now. Cancel anytime."}</p>
															<Button size='sm' variant='tertiary' onPress={onUpgradeOpen}>
																Upgrade now
															</Button>
														</div>
													)}
												</Alert.Content>
											</Alert>
										</div>
									)}
									<div
										className='flex w-full flex-col gap-4'
										style={{
											filter: ownerPlan === Plan.Free && !ownerHasAdvancedAccess && !isPlaylistOverlay ? "blur(1.5px)" : "none",
											pointerEvents: ownerPlan === Plan.Free && !ownerHasAdvancedAccess && !isPlaylistOverlay ? "none" : "auto",
											userSelect: ownerPlan === Plan.Free && !ownerHasAdvancedAccess && !isPlaylistOverlay ? "none" : "auto",
											WebkitUserSelect: ownerPlan === Plan.Free && !ownerHasAdvancedAccess && !isPlaylistOverlay ? "none" : "auto",
										}}
									>
										<div className='flex w-full flex-wrap items-end gap-2'>
											<Button
												variant='tertiary'
												onPress={async () => {
													const reward = await createChannelReward(overlay.ownerId);
													if (reward) {
														setOverlay({ ...overlay, rewardId: reward.id });
													}
												}}
												isDisabled={(ownerPlan === Plan.Free && !ownerHasAdvancedAccess) || !!overlay.rewardId}
											>
												Create Reward
											</Button>
											<TextField fullWidth className='min-w-0 flex-1'>
												<InputGroup fullWidth variant='secondary'>
													<InputGroup.Input
														onChange={(event) => {
															event.preventDefault();
														}}
														value={reward?.title}
														placeholder='Reward ID not set'
													/>
													{reward?.title ? (
														<CloseButton
															aria-label='Clear'
															onPress={() => {
																if (reward) {
																	removeChannelReward(reward.id, overlay.ownerId);
																}
																setOverlay({ ...overlay, rewardId: null });
															}}
														/>
													) : null}
												</InputGroup>
											</TextField>
											<Tooltip delay={0}>
												<Tooltip.Trigger>
													<Button isIconOnly size='sm' variant='ghost' aria-label='Reward information'>
														<IconInfoCircle size={18} />
													</Button>
												</Tooltip.Trigger>
												<Tooltip.Content>
													<div className='px-1 py-2'>
														<div className='text-xs'>You can edit the reward through your Twitch dashboard.</div>
													</div>
												</Tooltip.Content>
											</Tooltip>
										</div>

										<div className='flex w-full items-end gap-2'>
											<Select fullWidth variant='secondary' value={overlay.playbackMode} onChange={(value) => setOverlay({ ...overlay, playbackMode: value as PlaybackMode })} className='flex-1'>
												<Label>Playback Mode</Label>
												<Select.Trigger>
													<Select.Value />
													<Select.Indicator />
												</Select.Trigger>
												<Select.Popover>
													<ListBox>
														{playbackModes
															.filter((mode) => mode.key !== PlaybackMode.Order || (isPlaylistOverlay && !!overlay.playlistId))
															.map((mode) => (
																<ListBox.Item key={mode.key} id={mode.key} textValue={mode.label}>
																	<Label>{mode.label}</Label>
																	<ListBox.ItemIndicator />
																</ListBox.Item>
															))}
													</ListBox>
												</Select.Popover>
											</Select>
											<Tooltip delay={0}>
												<Tooltip.Trigger>
													<Button isIconOnly size='sm' variant='ghost' aria-label='Playback mode information'>
														<IconInfoCircle size={18} />
													</Button>
												</Tooltip.Trigger>
												<Tooltip.Content>{playbackModeHelpText[overlay.playbackMode] ?? playbackModeHelpText[PlaybackMode.Random]}</Tooltip.Content>
											</Tooltip>
										</div>
										{isPlaylistOverlay ? (
											<div className='px-2 py-2 space-y-2'>
												<div className='flex w-full items-center gap-2'>
													<Select
														fullWidth
														variant='secondary'
														value={overlay.playlistId}
														onChange={async (value) => {
															const selected = value as string;
															if (selected === "create_new") {
																try {
																	const playlist = await createPlaylist(currentOverlay.ownerId, "New Playlist");
																	if (playlist) {
																		await refreshPlaylists();
																		setOverlay((prev) => (prev ? { ...prev, playlistId: playlist.id, type: OverlayType.Playlist } : prev));
																		setPlaylistNameDraft(playlist.name);
																		addToast({ title: "Playlist created", color: "success" });
																		router.push(`/dashboard/playlist/${playlist.id}`);
																	}
																} catch {
																	addToast({ title: "Failed to create playlist", color: "danger" });
																}
																return;
															}
															setOverlay({ ...overlay, playlistId: selected ?? null });
														}}
														className='flex-1'
													>
														<Label>Playlist</Label>
														<Select.Trigger>
															<Select.Value />
															<Select.Indicator />
														</Select.Trigger>
														<Select.Popover>
															<ListBox>
																{playlists.map((playlist) => (
																	<ListBox.Item key={playlist.id} id={playlist.id} textValue={`${playlist.name} (${playlist.clipCount})`}>
																		<Label>{`${playlist.name} (${playlist.clipCount})`}</Label>
																		<ListBox.ItemIndicator />
																	</ListBox.Item>
																))}
																<ListBox.Item id='create_new' textValue='Create new playlist...'>
																	<Label>Create new playlist...</Label>
																</ListBox.Item>
															</ListBox>
														</Select.Popover>
													</Select>
													<Button
														onPress={() => {
															if (!overlay.playlistId) return;
															router.push(`/dashboard/playlist/${overlay.playlistId}`);
														}}
														isDisabled={!overlay.playlistId}
													>
														Manage
													</Button>
												</div>
											</div>
										) : (
											<>
												<Switch isSelected={overlay.preferCurrentCategory} onChange={(value) => setOverlay({ ...overlay, preferCurrentCategory: value })}>
													<Switch.Content>
														<Switch.Control>
															<Switch.Thumb />
														</Switch.Control>
														Prefer clips from current stream category
													</Switch.Content>
												</Switch>
												<Separator className='my-1' />
												<div className='grid w-full items-start gap-4 md:grid-cols-[minmax(0,8fr)_minmax(0,2fr)]'>
													<div className='w-full'>
														<Slider
															minValue={0}
															maxValue={60}
															value={[overlay.minClipDuration, overlay.maxClipDuration]}
															step={1}
															formatOptions={{ style: "unit", unit: "second" }}
															onChange={(value: number | number[]) => {
																const [min, max] = Array.isArray(value) ? (value as [number, number]) : [value as number, value as number];
																setOverlay({ ...overlay, minClipDuration: min, maxClipDuration: max });
															}}
														>
															<Label>Filter clips by duration (seconds)</Label>
															<Slider.Output />
															<Slider.Track className='mt-2'>
																{({ state }) => (
																	<>
																		<Slider.Fill />
																		{state.values.map((_, index) => (
																			<Slider.Thumb key={index} index={index} />
																		))}
																	</>
																)}
															</Slider.Track>
														</Slider>
														<div className='mt-1 flex justify-between text-xs text-muted'>
															<span>0s</span>
															<span>20s</span>
															<span>40s</span>
															<span>60s</span>
														</div>
													</div>
													<NumberField fullWidth variant='secondary' minValue={0} defaultValue={overlay.minClipViews} value={overlay.minClipViews} onChange={(value) => setOverlay({ ...overlay, minClipViews: Number(value) })}>
														<Label>Minimum Clip Views</Label>
														<NumberField.Group>
															<NumberField.DecrementButton />
															<NumberField.Input />
															<NumberField.IncrementButton />
														</NumberField.Group>
														<Description>Only clips with at least this many views will be shown in the overlay.</Description>
													</NumberField>
												</div>

												<div className='flex w-full flex-col gap-2'>
													<ComboBox
														fullWidth
														variant='secondary'
														inputValue={allowlistGameSearch}
														onInputChange={setAllowlistGameSearch}
														onSelectionChange={(key) => {
															if (!key) return;
															const game = allowlistGameResults.find((g) => g.id === key);
															const id = String(key);
															if (!overlay.categoriesOnly?.includes(id)) {
																setOverlay({ ...overlay, categoriesOnly: [...(overlay.categoriesOnly ?? []), id] });
																if (game) setGameDetailsById((prev) => ({ ...prev, [id]: game }));
															}
															setAllowlistGameSearch("");
														}}
													>
														<Label>Allowed Games / Categories</Label>
														<ComboBox.InputGroup>
															<Input placeholder='Search and add a game...' />
															{isSearchingAllowlistGames ? <span className='px-1 text-xs text-muted'>Loading</span> : null}
															<ComboBox.Trigger />
														</ComboBox.InputGroup>
														<ComboBox.Popover>
															<ListBox items={allowlistGameResults.slice(0, 100)}>
																{(item) => (
																	<ListBox.Item id={item.id} textValue={item.name}>
																		<Label className='flex items-center gap-2'>
																			{item.box_art_url ? <Image unoptimized src={item.box_art_url.replace("{width}", "32").replace("{height}", "44")} alt={item.name} width={24} height={32} className='h-8 w-6 rounded object-cover' /> : null}
																			<span>{item.name}</span>
																		</Label>
																		<ListBox.ItemIndicator />
																	</ListBox.Item>
																)}
															</ListBox>
														</ComboBox.Popover>
													</ComboBox>
													<div className='flex flex-wrap gap-1'>
														{(overlay.categoriesOnly ?? []).map((id) => (
															<Chip key={id} size='sm' variant='tertiary'>
																<span>{getGameName(id)}</span>
																<CloseButton aria-label={`Remove ${getGameName(id)}`} onPress={() => setOverlay({ ...overlay, categoriesOnly: overlay.categoriesOnly.filter((x) => x !== id) })} />
															</Chip>
														))}
													</div>
												</div>

												<div className='flex w-full flex-col gap-2'>
													<ComboBox
														fullWidth
														variant='secondary'
														inputValue={denylistGameSearch}
														onInputChange={setDenylistGameSearch}
														onSelectionChange={(key) => {
															if (!key) return;
															const game = denylistGameResults.find((g) => g.id === key);
															const id = String(key);
															if (!overlay.categoriesBlocked?.includes(id)) {
																setOverlay({ ...overlay, categoriesBlocked: [...(overlay.categoriesBlocked ?? []), id] });
																if (game) setGameDetailsById((prev) => ({ ...prev, [id]: game }));
															}
															setDenylistGameSearch("");
														}}
													>
														<Label>Blocked Games / Categories</Label>
														<ComboBox.InputGroup>
															<Input placeholder='Search and block a game...' />
															{isSearchingDenylistGames ? <span className='px-1 text-xs text-muted'>Loading</span> : null}
															<ComboBox.Trigger />
														</ComboBox.InputGroup>
														<ComboBox.Popover>
															<ListBox items={denylistGameResults.slice(0, 100)}>
																{(item) => (
																	<ListBox.Item id={item.id} textValue={item.name}>
																		<Label className='flex items-center gap-2'>
																			{item.box_art_url ? <Image unoptimized src={item.box_art_url.replace("{width}", "32").replace("{height}", "44")} alt={item.name} width={24} height={32} className='h-8 w-6 rounded object-cover' /> : null}
																			<span>{item.name}</span>
																		</Label>
																		<ListBox.ItemIndicator />
																	</ListBox.Item>
																)}
															</ListBox>
														</ComboBox.Popover>
													</ComboBox>
													<div className='flex flex-wrap gap-1'>
														{(overlay.categoriesBlocked ?? []).map((id) => (
															<Chip key={id} size='sm' variant='tertiary' color='danger'>
																<span>{getGameName(id)}</span>
																<CloseButton aria-label={`Remove ${getGameName(id)}`} onPress={() => setOverlay({ ...overlay, categoriesBlocked: overlay.categoriesBlocked.filter((x) => x !== id) })} />
															</Chip>
														))}
													</div>
												</div>

												<TagsInput fullWidth label='Creator Allowlist' value={overlay.clipCreatorsOnly} onValueChange={(value) => setOverlay({ ...overlay, clipCreatorsOnly: value })} description='Allow only specific clip creators (Twitch usernames).' />
												<TagsInput fullWidth label='Creator Denylist' value={overlay.clipCreatorsBlocked} onValueChange={(value) => setOverlay({ ...overlay, clipCreatorsBlocked: value })} description='Exclude specific clip creators from playback.' />
												<TagsInput fullWidth label='Blacklisted Words' value={overlay.blacklistWords} onValueChange={(value) => setOverlay({ ...overlay, blacklistWords: value })} description='Hide clips containing certain words in titles. Supports RE2 regex (no lookarounds).' />
											</>
										)}
										<Separator className='my-2' />
										<div className='px-2 pb-2'>
											<Button variant='primary' onPress={() => router.push(`/dashboard/overlay/${overlay.id}/theme`)} className='w-full'>
												{<IconPaint size={16} />}
												Customize Overlay Style
											</Button>
										</div>
									</div>
								</Form>
							</div>
						</Card.Content>
					</Card>
				</div>

				<ControlledModal isOpen={isCliplistOpen} onOpenChange={onCliplistOpenChange} dialogClassName='flex max-h-[80vh] flex-col overflow-hidden'>
					<Modal.Header className='flex w-full flex-row items-center justify-between gap-3 pt-10'>
						<Modal.Heading>Preview Clips</Modal.Heading>
						<Switch className='shrink-0' size='sm' isSelected={previewReviewMode} onChange={setPreviewReviewMode}>
							<Switch.Content>
								<Switch.Control>
									<Switch.Thumb />
								</Switch.Control>
								Review mode
							</Switch.Content>
						</Switch>
					</Modal.Header>
					<Modal.Body className='flex-1 overflow-y-auto'>
						<ul className='space-y-2'>
							{previewModalClips.map((clip) => (
								<li key={clip.id} className='flex gap-3 items-center rounded-md p-2 hover:bg-white/5 transition'>
									<a href={clip.url} target='_blank' rel='noopener noreferrer' className='flex items-center gap-3 w-full'>
										<Image unoptimized src={clip.thumbnail_url} alt={clip.title} width={80} height={48} className='h-12 w-20 flex-shrink-0 rounded object-cover' />
										<div className='min-w-0'>
											<p className='text-sm font-medium truncate'>{clip.title}</p>
											<p className='text-xs text-white/60'>clipped by {clip.creator_name}</p>
											<div className='text-xs text-white/60'>
												<span>{clip.view_count} views</span>
												<span className='mx-1'>|</span>
												<span>{clip.duration}s</span>
											</div>
										</div>
									</a>
								</li>
							))}
						</ul>
					</Modal.Body>
				</ControlledModal>

				<ControlledModal isOpen={isPlaylistOpen} onOpenChange={onPlaylistOpenChange} size='lg' containerClassName='max-w-2xl' dialogClassName='max-h-[85vh] overflow-hidden'>
					<Modal.Header className='flex items-center justify-between'>
						<Modal.Heading>{selectedPlaylist ? `Manage Playlist: ${selectedPlaylist.name}` : "Manage Playlist"}</Modal.Heading>
						<div className='flex items-center gap-2 pr-4'>
							<Button size='sm' variant='primary' className='font-semibold' onPress={handleOpenAddClips} isDisabled={!selectedPlaylist}>
								{<IconPlus size={14} />}
								Add clips
							</Button>
							<Button
								size='sm'
								variant='tertiary'
								onPress={() => {
									if (!selectedPlaylist) return;
									if (canUseAutoImport) {
										onImportOpen();
										return;
									}
									onAutoImportLockedOpen();
								}}
								isDisabled={!selectedPlaylist}
							>
								{<IconDownload size={14} />}
								Auto import
							</Button>
						</div>
					</Modal.Header>
					<Modal.Body className='overflow-y-auto'>
						<div className='mb-2'>
							<TextField fullWidth variant='secondary' isDisabled={!selectedPlaylist}>
								<Label>Playlist name</Label>
								<Input className='w-full' value={playlistNameDraft} onChange={(event) => setPlaylistNameDraft(event.target.value)} placeholder='Playlist name' />
							</TextField>
						</div>
						{isFreePlaylistLimitActive && (
							<div className='mb-3 rounded-lg border border-default bg-surface-secondary px-3 py-2'>
								<div className='mb-2 flex items-center justify-between text-xs text-muted'>
									<span>Free plan usage</span>
									<span>
										{playlistClipUsage}/{FREE_PLAYLIST_CLIP_LIMIT}
									</span>
								</div>
								<div className='h-2 rounded-full bg-default'>
									<div className='h-2 rounded-full bg-accent' style={{ width: `${playlistClipUsagePercent}%` }} />
								</div>
							</div>
						)}
						{playlistClips.length === 0 && <div className='py-8 text-center text-muted'>No clips in this playlist. Click &quot;Add clips&quot; to start.</div>}
						<div className='text-xs text-muted'>Reorder clips as needed. Changes are applied when you click Save Playlist.</div>
						<div className='flex items-center gap-2'>
							<Button
								size='sm'
								variant='tertiary'
								onPress={() => {
									if (playlistClips.length === 0) return;
									setSelectedPlaylistClipIds(new Set(playlistClips.map((clip) => clip.id)));
								}}
								isDisabled={playlistClips.length === 0}
							>
								Select all
							</Button>
							<Button size='sm' variant='tertiary' onPress={() => setSelectedPlaylistClipIds(new Set())} isDisabled={selectedPlaylistClipIds.size === 0}>
								Clear
							</Button>
							<Button
								size='sm'
								variant='danger-soft'
								onPress={() => {
									if (selectedPlaylistClipIds.size === 0) return;
									setPlaylistClips((prev) => prev.filter((clip) => !selectedPlaylistClipIds.has(clip.id)));
									setSelectedPlaylistClipIds(new Set());
								}}
								isDisabled={selectedPlaylistClipIds.size === 0}
							>
								Remove selected ({selectedPlaylistClipIds.size})
							</Button>
						</div>
						<ul className='space-y-2'>
							{playlistClips.map((clip) => (
								<li
									key={clip.id}
									draggable
									onDragStart={() => {
										setDraggedClipId(clip.id);
										setDragOverClipId(clip.id);
									}}
									onDragOver={(event) => {
										event.preventDefault();
										if (!draggedClipId || draggedClipId === clip.id) return;
										setDragOverClipId(clip.id);
										setPlaylistClips((prev) => reorderClips(prev, draggedClipId, clip.id));
									}}
									onDrop={() => {
										if (!draggedClipId) return;
										const next = reorderClips(playlistClips, draggedClipId, clip.id);
										setPlaylistClips(next);
										setDraggedClipId(null);
										setDragOverClipId(null);
									}}
									onDragEnd={() => {
										setDraggedClipId(null);
										setDragOverClipId(null);
									}}
									className={`flex items-center gap-3 rounded border px-3 py-2 transition-colors ${draggedClipId === clip.id ? "opacity-55 border-default bg-surface-secondary" : ""} ${dragOverClipId === clip.id && draggedClipId !== clip.id ? "border-accent bg-accent/10" : "border-default"}`}
								>
									<Checkbox
										aria-label={`Select ${clip.title}`}
										isSelected={selectedPlaylistClipIds.has(clip.id)}
										onChange={(checked) => {
											setSelectedPlaylistClipIds((prev) => {
												const next = new Set(prev);
												if (checked) next.add(clip.id);
												else next.delete(clip.id);
												return next;
											});
										}}
									>
										<Checkbox.Content>
											<Checkbox.Control>
												<Checkbox.Indicator />
											</Checkbox.Control>
										</Checkbox.Content>
									</Checkbox>
									<IconGripVertical size={16} className='text-muted' />
									<Image unoptimized src={clip.thumbnail_url} alt={clip.title} width={64} height={40} className='h-10 w-16 rounded object-cover' />
									<div className='min-w-0 flex-1'>
										<div className='truncate text-sm font-medium'>{clip.title}</div>
										<div className='text-xs text-muted'>{clip.creator_name}</div>
									</div>
									<div className='flex items-center gap-2'>
										<div className='text-xs text-muted'>{clip.view_count} views</div>
										<Button
											isIconOnly
											size='sm'
											variant='danger-soft'
											onPress={() => {
												setPlaylistClips((prev) => prev.filter((c) => c.id !== clip.id));
												setSelectedPlaylistClipIds((prev) => {
													const next = new Set(prev);
													next.delete(clip.id);
													return next;
												});
											}}
										>
											<IconTrash size={16} />
										</Button>
									</div>
								</li>
							))}
						</ul>
					</Modal.Body>
					<Modal.Footer>
						<Button variant='tertiary' onPress={onPlaylistClose}>
							Close
						</Button>
						<Button
							onPress={async () => {
								if (!overlay.playlistId) return;
								const nextName = playlistNameDraft.trim();
								if (!nextName) {
									addToast({ title: "Playlist name is required", color: "danger" });
									return;
								}

								if (selectedPlaylist && isSelectedPlaylistNameDirty) {
									const updated = await savePlaylist(selectedPlaylist.id, { name: nextName });
									if (!updated) {
										addToast({ title: "Failed to save playlist", color: "danger" });
										return;
									}
									await refreshPlaylists();
									setPlaylistNameDraft(updated.name);
								}

								if (isPlaylistDraftDirty) {
									const saved = await upsertPlaylistClips(overlay.playlistId, playlistClips, "replace");
									setPlaylistClips(saved);
									setSavedPlaylistClipIds(saved.map((clip) => clip.id));
									await refreshPlaylists();
								}

								addToast({ title: "Playlist saved", color: "success" });
							}}
							isDisabled={!overlay.playlistId || !canSaveManagedPlaylist || !playlistNameDraft.trim()}
							variant='primary'
						>
							{<IconDeviceFloppy size={16} />}
							Save Playlist
						</Button>
					</Modal.Footer>
				</ControlledModal>

				<ControlledModal isOpen={isAddClipsOpen} onOpenChange={onAddClipsOpenChange} size='lg' containerClassName='max-w-5xl' dialogClassName='max-h-[80vh]'>
					<Modal.Header className='flex flex-col gap-1'>
						<Modal.Heading>Select clips to add</Modal.Heading>
						<TextField fullWidth>
							<InputGroup fullWidth variant='secondary'>
								<InputGroup.Prefix>{<IconSearch size={16} />}</InputGroup.Prefix>
								<InputGroup.Input placeholder='Search by title or creator...' value={cachedClipsFilter} onChange={(event) => setCachedClipsFilter(event.target.value)} />
								{cachedClipsFilter ? <CloseButton aria-label='Clear' onPress={() => setCachedClipsFilter("")} /> : null}
							</InputGroup>
						</TextField>
					</Modal.Header>
					<Modal.Body className='overflow-y-auto'>
						<Table>
							<Table.ScrollContainer className='max-h-[56vh]'>
								<Table.Content aria-label='Cached clips table' selectionMode='multiple' selectedKeys={selectedCachedClipIds} onSelectionChange={setSelectedCachedClipIds} sortDescriptor={cachedClipsSortDescriptor} onSortChange={setCachedClipsSortDescriptor}>
									<Table.Header>
										<Table.Column className='pr-0'>
											<Checkbox aria-label='Select all clips' slot='selection'>
												<Checkbox.Content>
													<Checkbox.Control>
														<Checkbox.Indicator />
													</Checkbox.Control>
												</Checkbox.Content>
											</Checkbox>
										</Table.Column>
										<Table.Column id='clip' allowsSorting isRowHeader>
											{({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>Clip</Table.SortableColumnHeader>}
										</Table.Column>
										<Table.Column id='creator' allowsSorting>
											{({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>Creator</Table.SortableColumnHeader>}
										</Table.Column>
										<Table.Column id='category' allowsSorting>
											{({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>Category</Table.SortableColumnHeader>}
										</Table.Column>
										<Table.Column id='views' allowsSorting>
											{({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>Views</Table.SortableColumnHeader>}
										</Table.Column>
										<Table.Column id='date' allowsSorting>
											{({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>Date</Table.SortableColumnHeader>}
										</Table.Column>
									</Table.Header>
									<Table.Body
										renderEmptyState={() =>
											cachedClips === undefined ? (
												<span className='inline-flex items-center gap-2 p-4'>
													<Spinner />
													Loading clips...
												</span>
											) : (
												<div className='p-4 text-muted'>No clips found in cache.</div>
											)
										}
									>
										{sortedCachedClips.map((item) => (
											<Table.Row key={item.id} id={item.id} textValue={item.title}>
												<Table.Cell className='pr-0'>
													<Checkbox aria-label={`Select ${item.title}`} slot='selection'>
														<Checkbox.Content>
															<Checkbox.Control>
																<Checkbox.Indicator />
															</Checkbox.Control>
														</Checkbox.Content>
													</Checkbox>
												</Table.Cell>
												<Table.Cell>
													<div className='flex items-center gap-2'>
														<Image unoptimized src={item.thumbnail_url} alt={item.title} width={56} height={32} className='h-8 w-14 rounded object-cover' />
														<div className='truncate max-w-[250px]'>{item.title}</div>
													</div>
												</Table.Cell>
												<Table.Cell>{item.creator_name}</Table.Cell>
												<Table.Cell>{getGameName(item.game_id)}</Table.Cell>
												<Table.Cell>{item.view_count}</Table.Cell>
												<Table.Cell>{new Date(item.created_at).toLocaleDateString()}</Table.Cell>
											</Table.Row>
										))}
									</Table.Body>
								</Table.Content>
							</Table.ScrollContainer>
						</Table>
					</Modal.Body>
					<Modal.Footer>
						{wouldExceedFreeLimit && <div className='mr-auto text-xs text-danger'>Free plan limit is {FREE_PLAYLIST_CLIP_LIMIT} clips per playlist.</div>}
						<Button variant='tertiary' onPress={onAddClipsClose}>
							Cancel
						</Button>
						<Button onPress={handleAddSelectedClips} isDisabled={selectedIds.length === 0 || wouldExceedFreeLimit} variant='primary'>
							Add selected clips
						</Button>
					</Modal.Footer>
				</ControlledModal>

				<ControlledModal isOpen={isImportOpen} onOpenChange={onImportOpenChange}>
					<Modal.Header>
						<Modal.Heading>Auto Import to Playlist</Modal.Heading>
					</Modal.Header>
					<Modal.Body className='space-y-4'>
						<ComboBox
							fullWidth
							variant='secondary'
							isRequired
							allowsCustomValue
							inputValue={importCategoryInput}
							onInputChange={(value) => {
								setImportCategoryInput(value);
								const normalized = value.trim().toLowerCase();
								if (!normalized || normalized === "all" || normalized === "all categories") {
									setImportCategoryId("all");
									return;
								}
								if (value !== (importCategoryOptions.find((item) => item.id === importCategoryId)?.name ?? "")) {
									setImportCategoryId("");
								}
							}}
							onSelectionChange={(key) => {
								const nextId = (key as string) ?? "";
								setImportCategoryId(nextId);
								const selected = importCategoryOptions.find((item) => item.id === nextId);
								setImportCategoryInput(selected?.name ?? "");
							}}
							selectedKey={importCategoryId || null}
						>
							<Label>Category / Game</Label>
							<ComboBox.InputGroup>
								<Input placeholder='Type at least 2 characters or choose all' />
								{importCategoryInput ? (
									<button
										type='button'
										aria-label='Clear category'
										onClick={() => {
											setImportCategoryInput("");
											setImportCategoryId("");
										}}
									>
										×
									</button>
								) : null}
								{isSearchingGames ? <span className='px-1 text-xs text-muted'>Loading</span> : null}
								<ComboBox.Trigger />
							</ComboBox.InputGroup>
							<ComboBox.Popover>
								<ListBox items={importCategoryOptions}>
									{(item) => (
										<ListBox.Item id={item.id} textValue={item.name}>
											<Label className='flex items-center gap-2'>
												{item.box_art_url ? <Image unoptimized src={item.box_art_url.replace("{width}", "32").replace("{height}", "44")} alt={item.name} width={24} height={32} className='h-8 w-6 rounded object-cover' /> : null}
												<span>{item.name}</span>
											</Label>
											<ListBox.ItemIndicator />
										</ListBox.Item>
									)}
								</ListBox>
							</ComboBox.Popover>
						</ComboBox>

						<AppDateRangePicker
							label='Date Range'
							value={importStartDate && importEndDate ? { start: parseDate(importStartDate), end: parseDate(importEndDate) } : null}
							onChange={(range) => {
								if (!range) {
									setImportStartDate(DEFAULT_IMPORT_START_DATE);
									setImportEndDate(new Date().toISOString().slice(0, 10));
									return;
								}
								setImportStartDate(range.start.toString());
								setImportEndDate(range.end.toString());
							}}
						/>

						<NumberField fullWidth variant='secondary' minValue={0} value={importMinViews} onChange={(value) => setImportMinViews(Number(value) || 0)}>
							<Label>Minimum Views</Label>
							<NumberField.Group>
								<NumberField.DecrementButton />
								<NumberField.Input />
								<NumberField.IncrementButton />
							</NumberField.Group>
						</NumberField>
						<div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
							<NumberField fullWidth variant='secondary' minValue={0} value={importMinDuration} onChange={(value) => setImportMinDuration(Number(value) || 0)}>
								<Label>Min Duration (sec)</Label>
								<NumberField.Group>
									<NumberField.DecrementButton />
									<NumberField.Input />
									<NumberField.IncrementButton />
								</NumberField.Group>
							</NumberField>
							<NumberField fullWidth variant='secondary' minValue={0} value={importMaxDuration} onChange={(value) => setImportMaxDuration(Number(value) || 0)}>
								<Label>Max Duration (sec)</Label>
								<NumberField.Group>
									<NumberField.DecrementButton />
									<NumberField.Input />
									<NumberField.IncrementButton />
								</NumberField.Group>
							</NumberField>
						</div>
						<TagsInput fullWidth label='Creator Allowlist' value={importCreatorAllowlist} onValueChange={setImportCreatorAllowlist} />
						<TagsInput fullWidth label='Creator Denylist' value={importCreatorDenylist} onValueChange={setImportCreatorDenylist} />
						<TagsInput fullWidth label='Blacklisted Words' value={importBlacklistWords} onValueChange={setImportBlacklistWords} />
					</Modal.Body>
					<Modal.Footer>
						<Button variant='tertiary' onPress={onImportClose}>
							Cancel
						</Button>
						<Button
							isDisabled={!canUseAutoImport || !overlay.playlistId || !importCategoryId}
							onPress={() => {
								if (playlistClips.length > 0) setPendingImportMode("append");
								else runImport("replace");
							}}
							variant='primary'
						>
							{<IconDownload size={16} />}
							Import
						</Button>
					</Modal.Footer>
				</ControlledModal>

				<ControlledModal isOpen={pendingImportMode !== null} onOpenChange={() => setPendingImportMode(null)}>
					<Modal.Header>
						<Modal.Heading>Import Behavior</Modal.Heading>
					</Modal.Header>
					<Modal.Body>
						<div className='text-sm text-muted'>This playlist already has clips. Do you want to replace it or append imported clips?</div>
					</Modal.Body>
					<Modal.Footer>
						<Button
							variant='tertiary'
							onPress={async () => {
								setPendingImportMode(null);
								await runImport("append");
							}}
						>
							Append
						</Button>
						<Button
							onPress={async () => {
								setPendingImportMode(null);
								await runImport("replace");
							}}
							variant='danger'
						>
							Replace
						</Button>
					</Modal.Footer>
				</ControlledModal>

				<ControlledModal isOpen={isAutoImportLockedOpen} onOpenChange={onAutoImportLockedOpenChange}>
					<Modal.Header>
						<Modal.Heading>Auto Import Requires Pro</Modal.Heading>
					</Modal.Header>
					<Modal.Body>
						<div className='text-sm text-muted'>Auto import is available on Pro. Free includes one playlist with up to {FREE_PLAYLIST_CLIP_LIMIT} clips.</div>
					</Modal.Body>
					<Modal.Footer>
						<Button variant='tertiary' onPress={onAutoImportLockedClose}>
							Close
						</Button>
						<Button onPress={onUpgradeOpen} variant='primary'>
							Upgrade
						</Button>
					</Modal.Footer>
				</ControlledModal>

				<ControlledModal variant='blur' isOpen={navGuard.active} onClose={navGuard.reject}>
					<Modal.Header>
						<Modal.Heading className='flex items-center'>
							<IconAlertTriangle className='mr-2' />
							Unsaved Changes
						</Modal.Heading>
					</Modal.Header>
					<Modal.Body>
						<p className='text-sm text-foreground'>
							You&apos;ve made changes to your <span className='font-semibold text-foreground'>overlay settings</span> that haven&apos;t been saved. If you go back now, <span className='font-semibold text-danger'>those changes will be lost</span>.
							<br />
							<br />
							<span className='font-semibold text-foreground'>Do you want to continue without saving?</span>
						</p>
					</Modal.Body>
					<Modal.Footer>
						<Button variant='tertiary' onPress={navGuard.reject} aria-label='Cancel'>
							Cancel
						</Button>
						<Button onPress={navGuard.accept} aria-label='Discard Changes' variant='danger'>
							Discard changes
						</Button>
					</Modal.Footer>
				</ControlledModal>
			</DashboardNavbar>

			{user && <UpgradeModal isOpen={isUpgradeOpen} onOpenChange={onUpgradeOpenChange} user={user} title='Upgrade to unlock Pro overlay features' source='upgrade_modal' feature='advanced_filters' />}
		</>
	);
}
