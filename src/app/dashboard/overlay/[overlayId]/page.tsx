"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useParams, useRouter } from "next/navigation";
import { createPlaylist, getClipCacheStatus, getOverlay, getOverlayOwnerPlan, getPlaylistsForOwner, previewImportPlaylistClips, saveOverlay, savePlaylist, upsertPlaylistClips } from "@actions/database";
import { addToast, Autocomplete, AutocompleteItem, Button, Card, CardBody, CardHeader, Checkbox, Chip, DateRangePicker, Divider, Form, Image, Input, Link, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, NumberInput, Select, SelectItem, Slider, Snippet, Spinner, Switch, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Tooltip, useDisclosure } from "@heroui/react";
import { AuthenticatedUser, Game, Overlay, OverlayType, Plan, PlaybackMode, StatusOptions, TwitchClip, TwitchReward } from "@types";
import { IconAlertTriangle, IconArrowLeft, IconCrown, IconDeviceFloppy, IconDownload, IconGripVertical, IconInfoCircle, IconPaint, IconPlayerPauseFilled, IconPlayerPlayFilled, IconPlus, IconSearch, IconTrash } from "@tabler/icons-react";
import DashboardNavbar from "@components/dashboardNavbar";
import { useNavigationGuard } from "next-navigation-guard";
import { validateAuth } from "@actions/auth";
import { createChannelReward, getCachedClipsByOwner, getGameDetails, getReward, getTwitchClips, getTwitchGames, removeChannelReward } from "@actions/twitch";
import { REWARD_NOT_FOUND } from "@lib/twitchErrors";
import FeedbackWidget from "@components/feedbackWidget";
import TagsInput from "@components/tagsInput";
import { isTitleBlocked } from "@/app/utils/regexFilter";
import UpgradeModal from "@components/upgradeModal";
import ChatwootData from "@components/chatwootData";
import { getTrialDaysLeft, isReverseTrialActive } from "@lib/featureAccess";
import { usePlausible } from "next-plausible";
import { trackPaywallEvent } from "@lib/paywallTracking";
import type { Selection, SortDescriptor } from "@heroui/react";
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
	[PlaybackMode.Order]: "Plays clips in the saved playlist order (Reihenfolge).",
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

	const { isOpen: isCliplistOpen, onOpen: onCliplistOpen, onOpenChange: onCliplistOpenChange } = useDisclosure();
	const { isOpen: isPlaylistOpen, onClose: onPlaylistClose, onOpenChange: onPlaylistOpenChange } = useDisclosure();
	const { isOpen: isImportOpen, onOpen: onImportOpen, onClose: onImportClose, onOpenChange: onImportOpenChange } = useDisclosure();
	const { isOpen: isAddClipsOpen, onOpen: onAddClipsOpen, onOpenChange: onAddClipsOpenChange } = useDisclosure();
	const { isOpen: isUpgradeOpen, onOpen: onUpgradeOpen, onOpenChange: onUpgradeOpenChange } = useDisclosure();
	const { isOpen: isAutoImportLockedOpen, onOpen: onAutoImportLockedOpen, onOpenChange: onAutoImportLockedOpenChange } = useDisclosure();
	const plausible = usePlausible();

	const navGuard = useNavigationGuard({ enabled: isFormDirty() });

	useEffect(() => {
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
		[overlay?.ownerId, gameDetailsById],
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
			onAddClipsOpenChange();
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
		setSelectedPlaylistClipIds((prev) => new Set(Array.from(prev).filter((id) => playlistClips.some((clip) => clip.id === id))));
	}, [playlistClips]);

	useEffect(() => {
		if (!overlay?.playlistId) {
			setPlaylistNameDraft("");
			return;
		}
		const current = playlists.find((playlist) => playlist.id === overlay.playlistId);
		setPlaylistNameDraft(current?.name ?? "");
	}, [overlay?.playlistId, playlists]);

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
		return (
			<div className='flex flex-col items-center justify-center w-full h-screen'>
				<Spinner label='Loading overlay' />
			</div>
		);
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
			return [...filteredPreviewClips]
				.map((clip) => ({ clip, sort: Math.random() }))
				.sort((a, b) => a.sort - b.sort)
				.map((entry) => entry.clip);
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
					const jitter = Math.random() * 0.25;
					const score = Math.max(0.05, 0.58 * viewScore + 0.25 * jitter + exploreBoost - creatorPenalty - gamePenalty);
					return { clip, score };
				});

				const totalWeight = scored.reduce((sum, entry) => sum + entry.score, 0);
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
			<script src='//tag.goadopt.io/injector.js?website_code=792b9b29-57f9-4d92-b5f1-313f94ddfacc' className='adopt-injector' defer></script>
			<ChatwootData user={user} overlay={overlay} />

			<DashboardNavbar user={user!} title='Overlay Settings' tagline='Manage your overlays'>
				<FeedbackWidget />

				<div className='flex flex-col items-center justify-center w-full p-4'>
					<Card className='w-full max-w-4xl'>
						<CardHeader className='justify-between space-x-1'>
							<div className='flex items-center'>
								<Button
									isIconOnly
									variant='light'
									onPress={() => {
										router.push(`${baseUrl}/dashboard`);
									}}
								>
									<IconArrowLeft />
								</Button>
								<h1 className='text-xl font-bold'>Overlay Settings</h1>
							</div>
							<span className='text-sm text-gray-500'>ID: {overlayId}</span>
						</CardHeader>
						<Divider />
						<CardBody>
							<div className='flex items-center'>
								<Form className='w-full' onSubmit={handleSubmit}>
									<div className='flex items-center w-full space-x-4'>
										<Switch
											isSelected={overlay.status === StatusOptions.Active}
											onValueChange={(value) => {
												setOverlay({ ...overlay, status: value ? StatusOptions.Active : StatusOptions.Paused });
											}}
											startContent={<IconPlayerPlayFilled />}
											endContent={<IconPlayerPauseFilled />}
										/>
										<div className='flex-1 overflow-hidden'>
											<Snippet
												className='w-full max-w-full'
												symbol=''
												classNames={{
													pre: "overflow-hidden whitespace-nowrap",
												}}
											>
												{overlay.secret ? `${baseUrl}/overlay/${overlayId}?secret=${overlay.secret}` : "Missing secret. Refresh this page to generate one."}
											</Snippet>
										</div>
										<Button type='submit' color='primary' isIconOnly isDisabled={!isFormDirty()} aria-label='Save Overlay Settings'>
											<IconDeviceFloppy />
										</Button>
									</div>
									<div className='w-full flex flex-col gap-2 mb-2'>
										<div className='w-full flex justify-center items-center text-xs text-warning-300 p-2 border border-warning-200 rounded bg-warning-50 max-w-full'>
											<IconAlertTriangle size={16} className='mr-2 flex-shrink-0' />
											<span className='text-center'>
												Do not share this URL publicly. For embedding on websites, use the{" "}
												<Link color='warning' underline='always' className='text-xs' href={`${baseUrl}/dashboard/embed?oid=${overlayId}`}>
													embed widget tool
												</Link>
												.
											</span>
										</div>
										<p className='text-xs text-default-500 text-center'>
											For OBS/Streamlabs browser sources, use <span className='font-semibold'>1920x1080</span> for best scaling.
										</p>
									</div>
									<Input
										value={overlay.name}
										onValueChange={(value) => {
											setOverlay({ ...overlay, name: value });
										}}
										isRequired
										label='Overlay Name'
									/>
									<div className='w-full flex items-center'>
										<Select
											isRequired
											selectedKeys={[overlay.type]}
											onSelectionChange={(value) => {
												const nextType = value.currentKey as OverlayType;
												const fallbackPlaylistId = playlists[0]?.id ?? null;
												setOverlay({
													...overlay,
													type: nextType,
													playlistId: nextType === OverlayType.Playlist ? (overlay.playlistId ?? fallbackPlaylistId) : null,
													playbackMode: nextType === OverlayType.Playlist ? overlay.playbackMode : (overlay.playbackMode === PlaybackMode.Order ? PlaybackMode.Random : overlay.playbackMode),
												});
											}}
											label='Overlay Type'
										>
											{overlayTypes.map((type) => (
												<SelectItem key={type.key}>{type.key !== "Queue" ? type.label : type.label}</SelectItem>
											))}
										</Select>
										<Button isIconOnly onPress={onCliplistOpen} size='lg' className='ml-2'>
											<span>{filteredPreviewClips.length}</span>
										</Button>
									</div>
									{showCoverageWarning && (
										<div className='w-full mt-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-warning-800 text-xs flex items-center justify-between gap-2'>
											<div className='flex items-start gap-2'>
												<IconInfoCircle size={16} className='mt-0.5 text-warning-600' />
												<span>{overlay.type === OverlayType.All ? "All-time crawl is still syncing. Older clips may not appear yet." : "Selected time range is not fully cached yet. Results may be incomplete until crawl catches up."}</span>
											</div>
											<Link href='/dashboard/settings' color='warning' underline='always' className='text-xs whitespace-nowrap'>
												View crawl status
											</Link>
										</div>
									)}

									<Divider className='my-4' />
									{ownerPlan === Plan.Free && !ownerHasAdvancedAccess && (
										<div className='w-full mb-4'>
											<Card className='bg-warning-50 border border-warning-200 mb-2'>
												<CardBody>
													<div className='flex items-center gap-2 mb-1'>
														<IconCrown className='text-warning-500' />
														<span className='text-warning-800 font-semibold text-base'>Pro Feature Locked</span>
													</div>
													<p className='text-sm text-warning-700'>
														Unlock advanced overlay settings with <span className='font-semibold'>Pro</span>.
													</p>
													<ul className='list-disc list-inside text-warning-700 text-xs mt-2 ml-1'>
														<li>Multiple overlay</li>
														<li>Link custom Twitch rewards</li>
														<li>Control your overlay via chat</li>
														<li>Advanced clip filtering</li>
														<li>Theme studio with drag & drop layout</li>
														<li>Priority support</li>
													</ul>
													<Button
														color='warning'
														variant='shadow'
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
														<div className='mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-300 bg-warning-100 px-3 py-2'>
															<p className='text-xs text-warning-700'>{inTrial ? `Trial active: ${trialDaysLeft <= 1 ? "ends today." : `${trialDaysLeft} days left.`}` : "Start Pro now. Cancel anytime."}</p>
															<Button size='sm' color='warning' variant='flat' onPress={onUpgradeOpen}>
																Upgrade now
															</Button>
														</div>
													)}
												</CardBody>
											</Card>
										</div>
									)}
									<div
										className='w-full'
										style={{
											filter: ownerPlan === Plan.Free && !ownerHasAdvancedAccess && !isPlaylistOverlay ? "blur(1.5px)" : "none",
											pointerEvents: ownerPlan === Plan.Free && !ownerHasAdvancedAccess && !isPlaylistOverlay ? "none" : "auto",
											userSelect: ownerPlan === Plan.Free && !ownerHasAdvancedAccess && !isPlaylistOverlay ? "none" : "auto",
											WebkitUserSelect: ownerPlan === Plan.Free && !ownerHasAdvancedAccess && !isPlaylistOverlay ? "none" : "auto",
										}}
									>
										<div className='flex w-full items-center px-2 mb-2 gap-1'>
											<Button
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
											<Input
												isClearable
												onChange={(event) => {
													event.preventDefault();
												}}
												onClear={() => {
													if (reward) {
														removeChannelReward(reward.id, overlay.ownerId);
													}
													setOverlay({ ...overlay, rewardId: null });
												}}
												value={reward?.title}
												placeholder='Reward ID not set'
											/>
											<Tooltip
												content={
													<div className='px-1 py-2'>
														<div className='text-tiny'>You can edit the reward through your Twitch dashboard.</div>
													</div>
												}
											>
												<IconInfoCircle className='text-default-400' />
											</Tooltip>
										</div>

										<div className='flex w-full items-center px-2 mb-2 gap-1'>
											<Select selectedKeys={[overlay.playbackMode]} onSelectionChange={(value) => setOverlay({ ...overlay, playbackMode: value.currentKey as PlaybackMode })} label='Playback Mode' className='flex-1'>
												{playbackModes
													.filter((mode) => mode.key !== PlaybackMode.Order || (isPlaylistOverlay && !!overlay.playlistId))
													.map((mode) => (
													<SelectItem key={mode.key}>{mode.label}</SelectItem>
												))}
											</Select>
											<Tooltip content={playbackModeHelpText[overlay.playbackMode] ?? playbackModeHelpText[PlaybackMode.Random]}>
												<IconInfoCircle className='text-default-400' />
											</Tooltip>
										</div>
										{isPlaylistOverlay ? (
											<div className='px-2 py-2 space-y-2'>
												<div className='flex w-full items-center gap-2'>
													<Select
														selectedKeys={overlay.playlistId ? [overlay.playlistId] : []}
														onSelectionChange={async (value) => {
															const selected = value.currentKey as string;
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
														label='Playlist'
														className='flex-1'
													>
														{[
															...playlists.map((playlist) => (
																<SelectItem key={playlist.id} textValue={`${playlist.name} (${playlist.clipCount})`}>
																	{`${playlist.name} (${playlist.clipCount})`}
																</SelectItem>
															)),
															<SelectItem key='create_new' textValue='Create new playlist...'>
																Create new playlist...
															</SelectItem>,
														]}
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
												<Switch className='p-2' isSelected={overlay.preferCurrentCategory} onValueChange={(value) => setOverlay({ ...overlay, preferCurrentCategory: value })}>
													Prefer clips from current stream category
												</Switch>
												<Slider
													minValue={0}
													maxValue={60}
													defaultValue={[overlay.minClipDuration, overlay.maxClipDuration]}
													value={[overlay.minClipDuration, overlay.maxClipDuration]}
													step={1}
													label='Filter clips by duration (seconds)'
													showTooltip
													marks={[
														{ value: 0, label: "0s" },
														{ value: 20, label: "20s" },
														{ value: 40, label: "40s" },
														{ value: 60, label: "60s" },
													]}
													formatOptions={{ style: "unit", unit: "second" }}
													onChange={(value: number | number[]) => {
														const [min, max] = Array.isArray(value) ? (value as [number, number]) : [value as number, value as number];
														setOverlay({ ...overlay, minClipDuration: min, maxClipDuration: max });
													}}
													className='p-2'
													size='sm'
												/>
												<NumberInput size='sm' minValue={0} defaultValue={overlay.minClipViews} value={overlay.minClipViews} onValueChange={(value) => setOverlay({ ...overlay, minClipViews: Number(value) })} label='Minimum Clip Views' description='Only clips with at least this many views will be shown in the overlay.' className='p-2' />

												<div className='p-2 space-y-2'>
													<Autocomplete
														label='Allowed Games / Categories'
														placeholder='Search and add a game...'
														items={allowlistGameResults.slice(0, 100)}
														isLoading={isSearchingAllowlistGames}
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
														{(item) => (
															<AutocompleteItem key={item.id} textValue={item.name}>
																<div className='flex items-center gap-2'>
																	<Image src={item.box_art_url?.replace("{width}", "32").replace("{height}", "44")} alt={item.name} className='h-8 w-6 rounded object-cover' />
																	<span>{item.name}</span>
																</div>
															</AutocompleteItem>
														)}
													</Autocomplete>
													<div className='flex flex-wrap gap-1'>
														{(overlay.categoriesOnly ?? []).map((id) => (
															<Chip key={id} onClose={() => setOverlay({ ...overlay, categoriesOnly: overlay.categoriesOnly.filter((x) => x !== id) })} size='sm' variant='flat'>
																{getGameName(id)}
															</Chip>
														))}
													</div>
												</div>

												<div className='p-2 space-y-2'>
													<Autocomplete
														label='Blocked Games / Categories'
														placeholder='Search and block a game...'
														items={denylistGameResults.slice(0, 100)}
														isLoading={isSearchingDenylistGames}
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
														{(item) => (
															<AutocompleteItem key={item.id} textValue={item.name}>
																<div className='flex items-center gap-2'>
																	<Image src={item.box_art_url?.replace("{width}", "32").replace("{height}", "44")} alt={item.name} className='h-8 w-6 rounded object-cover' />
																	<span>{item.name}</span>
																</div>
															</AutocompleteItem>
														)}
													</Autocomplete>
													<div className='flex flex-wrap gap-1'>
														{(overlay.categoriesBlocked ?? []).map((id) => (
															<Chip key={id} onClose={() => setOverlay({ ...overlay, categoriesBlocked: overlay.categoriesBlocked.filter((x) => x !== id) })} size='sm' variant='flat' color='danger'>
																{getGameName(id)}
															</Chip>
														))}
													</div>
												</div>

												<TagsInput className='p-2' fullWidth label='Creator Allowlist' value={overlay.clipCreatorsOnly} onValueChange={(value) => setOverlay({ ...overlay, clipCreatorsOnly: value })} description='Allow only specific clip creators (Twitch usernames).' />
												<TagsInput className='p-2' fullWidth label='Creator Denylist' value={overlay.clipCreatorsBlocked} onValueChange={(value) => setOverlay({ ...overlay, clipCreatorsBlocked: value })} description='Exclude specific clip creators from playback.' />
												<TagsInput className='p-2' fullWidth label='Blacklisted Words' value={overlay.blacklistWords} onValueChange={(value) => setOverlay({ ...overlay, blacklistWords: value })} description='Hide clips containing certain words in titles. Supports RE2 regex (no lookarounds).' />
											</>
										)}
										<Divider className='my-2' />
										<div className='px-2 pb-2'>
											<Button color='primary' variant='solid' fullWidth startContent={<IconPaint size={16} />} onPress={() => router.push(`/dashboard/overlay/${overlay.id}/theme`)}>
												Customize Overlay Style
											</Button>
										</div>
									</div>
								</Form>
							</div>
						</CardBody>
					</Card>
				</div>

				<Modal isOpen={isCliplistOpen} onOpenChange={onCliplistOpenChange}>
					<ModalContent className='flex max-h-[80vh] flex-col overflow-hidden'>
						<ModalHeader className='flex items-center justify-between gap-3'>
							<span>Preview Clips</span>
							<Switch size='sm' isSelected={previewReviewMode} onValueChange={setPreviewReviewMode}>
								Review mode
							</Switch>
						</ModalHeader>
						<ModalBody className='flex-1 overflow-y-auto'>
							<ul className='space-y-2'>
								{previewModalClips.map((clip) => (
									<li key={clip.id} className='flex gap-3 items-center rounded-md p-2 hover:bg-white/5 transition'>
										<a href={clip.url} target='_blank' rel='noopener noreferrer' className='flex items-center gap-3 w-full'>
											<Image src={clip.thumbnail_url} alt={clip.title} className='h-12 w-20 rounded object-cover flex-shrink-0' />
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
						</ModalBody>
					</ModalContent>
				</Modal>

				<Modal isOpen={isPlaylistOpen} onOpenChange={onPlaylistOpenChange} size='2xl'>
					<ModalContent className='max-h-[85vh] overflow-hidden'>
						<ModalHeader className='flex items-center justify-between'>
							<div>{selectedPlaylist ? `Manage Playlist: ${selectedPlaylist.name}` : "Manage Playlist"}</div>
							<div className='flex items-center gap-2 pr-4'>
								<Button size='sm' color='primary' variant='solid' startContent={<IconPlus size={14} />} className='font-semibold' onPress={handleOpenAddClips} isDisabled={!selectedPlaylist}>
									Add clips
								</Button>
								<Button
									size='sm'
									variant='flat'
									startContent={<IconDownload size={14} />}
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
									Auto import
								</Button>
							</div>
						</ModalHeader>
						<ModalBody className='overflow-y-auto'>
							<div className='mb-2'>
								<Input size='sm' label='Playlist name' value={playlistNameDraft} onValueChange={setPlaylistNameDraft} placeholder='Playlist name' isDisabled={!selectedPlaylist} />
							</div>
							{isFreePlaylistLimitActive && (
								<div className='mb-3 rounded-lg border border-default-200 bg-content2 px-3 py-2'>
									<div className='mb-2 flex items-center justify-between text-xs text-default-600'>
										<span>Free plan usage</span>
										<span>
											{playlistClipUsage}/{FREE_PLAYLIST_CLIP_LIMIT}
										</span>
									</div>
									<div className='h-2 rounded-full bg-default-200'>
										<div className='h-2 rounded-full bg-primary' style={{ width: `${playlistClipUsagePercent}%` }} />
									</div>
								</div>
							)}
							{playlistClips.length === 0 && <div className='py-8 text-center text-default-400'>No clips in this playlist. Click &quot;Add clips&quot; to start.</div>}
							<div className='text-xs text-default-500'>Reorder clips as needed. Changes are applied when you click Save Playlist.</div>
							<div className='flex items-center gap-2'>
								<Button
									size='sm'
									variant='flat'
									onPress={() => {
										if (playlistClips.length === 0) return;
										setSelectedPlaylistClipIds(new Set(playlistClips.map((clip) => clip.id)));
									}}
									isDisabled={playlistClips.length === 0}
								>
									Select all
								</Button>
								<Button size='sm' variant='light' onPress={() => setSelectedPlaylistClipIds(new Set())} isDisabled={selectedPlaylistClipIds.size === 0}>
									Clear
								</Button>
								<Button
									size='sm'
									color='danger'
									variant='flat'
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
										className={`flex items-center gap-3 rounded border px-3 py-2 transition-colors ${draggedClipId === clip.id ? "opacity-55 border-default-300 bg-content2" : ""} ${dragOverClipId === clip.id && draggedClipId !== clip.id ? "border-primary bg-primary/10" : "border-default-200"}`}
									>
										<Checkbox
											isSelected={selectedPlaylistClipIds.has(clip.id)}
											onValueChange={(checked) => {
												setSelectedPlaylistClipIds((prev) => {
													const next = new Set(prev);
													if (checked) next.add(clip.id);
													else next.delete(clip.id);
													return next;
												});
											}}
										/>
										<IconGripVertical size={16} className='text-default-400' />
										<Image src={clip.thumbnail_url} alt={clip.title} className='h-10 w-16 rounded object-cover' />
										<div className='min-w-0 flex-1'>
											<div className='truncate text-sm font-medium'>{clip.title}</div>
											<div className='text-xs text-default-500'>{clip.creator_name}</div>
										</div>
										<div className='flex items-center gap-2'>
											<div className='text-xs text-default-500'>{clip.view_count} views</div>
											<Button
												isIconOnly
												size='sm'
												variant='light'
												color='danger'
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
						</ModalBody>
						<ModalFooter>
							<Button variant='light' onPress={onPlaylistClose}>
								Close
							</Button>
							<Button
								color='primary'
								startContent={<IconDeviceFloppy size={16} />}
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
							>
								Save Playlist
							</Button>
						</ModalFooter>
					</ModalContent>
				</Modal>

				<Modal isOpen={isAddClipsOpen} onOpenChange={onAddClipsOpenChange} size='5xl'>
					<ModalContent className='max-h-[80vh]'>
						<ModalHeader className='flex flex-col gap-1'>
							<div>Select clips to add</div>
							<Input size='sm' placeholder='Search by title or creator...' startContent={<IconSearch size={16} />} value={cachedClipsFilter} onValueChange={setCachedClipsFilter} isClearable />
						</ModalHeader>
						<ModalBody className='overflow-y-auto'>
							<Table
								aria-label='Cached clips table'
								selectionMode='multiple'
								selectedKeys={selectedCachedClipIds}
								onSelectionChange={setSelectedCachedClipIds}
								sortDescriptor={cachedClipsSortDescriptor}
								onSortChange={setCachedClipsSortDescriptor}
								classNames={{
									wrapper: "max-h-[56vh]",
								}}
							>
								<TableHeader>
									<TableColumn key='clip' allowsSorting>
										Clip
									</TableColumn>
									<TableColumn key='creator' allowsSorting>
										Creator
									</TableColumn>
									<TableColumn key='category' allowsSorting>
										Category
									</TableColumn>
									<TableColumn key='views' allowsSorting>
										Views
									</TableColumn>
									<TableColumn key='date' allowsSorting>
										Date
									</TableColumn>
								</TableHeader>
								<TableBody items={sortedCachedClips} emptyContent={cachedClips === undefined ? <Spinner label='Loading clips...' /> : <div className='text-default-400'>No clips found in cache.</div>}>
									{(item) => (
										<TableRow key={item.id}>
											<TableCell>
												<div className='flex items-center gap-2'>
													<Image src={item.thumbnail_url} alt={item.title} className='h-8 w-14 rounded object-cover' />
													<div className='truncate max-w-[250px]'>{item.title}</div>
												</div>
											</TableCell>
											<TableCell>{item.creator_name}</TableCell>
											<TableCell>{getGameName(item.game_id)}</TableCell>
											<TableCell>{item.view_count}</TableCell>
											<TableCell>{new Date(item.created_at).toLocaleDateString()}</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
						</ModalBody>
						<ModalFooter>
							{wouldExceedFreeLimit && <div className='mr-auto text-xs text-danger'>Free plan limit is {FREE_PLAYLIST_CLIP_LIMIT} clips per playlist.</div>}
							<Button variant='light' onPress={onAddClipsOpenChange}>
								Cancel
							</Button>
							<Button color='primary' onPress={handleAddSelectedClips} isDisabled={selectedIds.length === 0 || wouldExceedFreeLimit}>
								Add selected clips
							</Button>
						</ModalFooter>
					</ModalContent>
				</Modal>

				<Modal isOpen={isImportOpen} onOpenChange={onImportOpenChange}>
					<ModalContent>
						<ModalHeader>Auto Import to Playlist</ModalHeader>
						<ModalBody className='space-y-4'>
							<Autocomplete
								label='Category / Game'
								isRequired
								allowsCustomValue
								isClearable
								items={importCategoryOptions}
								isLoading={isSearchingGames}
								placeholder='Type at least 2 characters or choose all'
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
								{(item) => (
									<AutocompleteItem key={item.id} textValue={item.name}>
										<div className='flex items-center gap-2'>
											{item.box_art_url ? <Image src={item.box_art_url.replace("{width}", "32").replace("{height}", "44")} alt={item.name} className='h-8 w-6 rounded object-cover' /> : null}
											<span>{item.name}</span>
										</div>
									</AutocompleteItem>
								)}
							</Autocomplete>

							<DateRangePicker
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

							<NumberInput label='Minimum Views' minValue={0} value={importMinViews} onValueChange={(value) => setImportMinViews(Number(value) || 0)} />
							<div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
								<NumberInput label='Min Duration (sec)' minValue={0} value={importMinDuration} onValueChange={(value) => setImportMinDuration(Number(value) || 0)} />
								<NumberInput label='Max Duration (sec)' minValue={0} value={importMaxDuration} onValueChange={(value) => setImportMaxDuration(Number(value) || 0)} />
							</div>
							<TagsInput fullWidth label='Creator Allowlist' value={importCreatorAllowlist} onValueChange={setImportCreatorAllowlist} />
							<TagsInput fullWidth label='Creator Denylist' value={importCreatorDenylist} onValueChange={setImportCreatorDenylist} />
							<TagsInput fullWidth label='Blacklisted Words' value={importBlacklistWords} onValueChange={setImportBlacklistWords} />
						</ModalBody>
						<ModalFooter>
							<Button variant='light' onPress={onImportClose}>
								Cancel
							</Button>
							<Button
								color='primary'
								startContent={<IconDownload size={16} />}
								isDisabled={!canUseAutoImport || !overlay.playlistId || !importCategoryId}
								onPress={() => {
									if (playlistClips.length > 0) setPendingImportMode("append");
									else runImport("replace");
								}}
							>
								Import
							</Button>
						</ModalFooter>
					</ModalContent>
				</Modal>

				<Modal isOpen={pendingImportMode !== null} onOpenChange={() => setPendingImportMode(null)}>
					<ModalContent>
						<ModalHeader>Import Behavior</ModalHeader>
						<ModalBody>
							<div className='text-sm text-default-600'>This playlist already has clips. Do you want to replace it or append imported clips?</div>
						</ModalBody>
						<ModalFooter>
							<Button
								variant='light'
								onPress={async () => {
									setPendingImportMode(null);
									await runImport("append");
								}}
							>
								Append
							</Button>
							<Button
								color='danger'
								onPress={async () => {
									setPendingImportMode(null);
									await runImport("replace");
								}}
							>
								Replace
							</Button>
						</ModalFooter>
					</ModalContent>
				</Modal>

				<Modal isOpen={isAutoImportLockedOpen} onOpenChange={onAutoImportLockedOpenChange}>
					<ModalContent>
						<ModalHeader>Auto Import Requires Pro</ModalHeader>
						<ModalBody>
							<div className='text-sm text-default-600'>Auto import is available on Pro. Free includes one playlist with up to {FREE_PLAYLIST_CLIP_LIMIT} clips.</div>
						</ModalBody>
						<ModalFooter>
							<Button variant='light' onPress={onAutoImportLockedOpenChange}>
								Close
							</Button>
							<Button color='primary' onPress={onUpgradeOpen}>
								Upgrade
							</Button>
						</ModalFooter>
					</ModalContent>
				</Modal>

				<Modal backdrop='blur' isOpen={navGuard.active} onClose={navGuard.reject}>
					<ModalContent>
						<ModalHeader>
							<div className='flex items-center'>
								<IconAlertTriangle className='mr-2' />
								Unsaved Changes
							</div>
						</ModalHeader>
						<ModalBody>
							<p className='text-sm text-default-700'>
								You&apos;ve made changes to your <span className='font-semibold text-default-900'>overlay settings</span> that haven&apos;t been saved. If you go back now, <span className='font-semibold text-danger'>those changes will be lost</span>.
								<br />
								<br />
								<span className='font-semibold text-default-900'>Do you want to continue without saving?</span>
							</p>
						</ModalBody>
						<ModalFooter>
							<Button variant='light' onPress={navGuard.reject} aria-label='Cancel'>
								Cancel
							</Button>
							<Button color='danger' onPress={navGuard.accept} aria-label='Discard Changes'>
								Discard changes
							</Button>
						</ModalFooter>
					</ModalContent>
				</Modal>
			</DashboardNavbar>

			{user && <UpgradeModal isOpen={isUpgradeOpen} onOpenChange={onUpgradeOpenChange} user={user} title='Upgrade to unlock Pro overlay features' source='upgrade_modal' feature='advanced_filters' />}
		</>
	);
}
