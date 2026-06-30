"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAllPlaylists, getPlaylistClips, previewImportPlaylistClips, savePlaylist, upsertPlaylistClips } from "@actions/database";
import { addToast, Button, Card, Checkbox, ComboBox, DateRangePicker, Separator, Input, Label, Link, ListBox, Modal, NumberInput, Pagination, Spinner, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, useDisclosure, TextField, InputGroup, CloseButton } from "@heroui/react";
import Image from "next/image";
import type { Selection, SortDescriptor } from "@heroui/react";

import { AuthenticatedUser, Game, OverlayType, TwitchClip } from "@types";
import { IconAlertTriangle, IconArrowLeft, IconDeviceFloppy, IconDownload, IconGripVertical, IconPlus, IconSearch, IconTrash } from "@tabler/icons-react";
import DashboardNavbar from "@components/dashboardNavbar";
import ControlledModal from "@components/controlledModal";
import { useNavigationGuard } from "next-navigation-guard";
import { validateAuth } from "@actions/auth";
import { getCachedClipsByOwner, getGamesDetailsBulk, getTwitchGames } from "@actions/twitch";
import { getFeatureAccess } from "@lib/featureAccess";
import TagsInput from "@components/tagsInput";
import { parseDate } from "@internationalized/date";

const ALL_CATEGORIES_OPTION: Game = {
	id: "all",
	name: "All categories",
	box_art_url: "",
	igdb_id: "",
};
const FREE_PLAYLIST_CLIP_LIMIT = 50;
const DEFAULT_IMPORT_START_DATE = "2016-01-01";
const normalizeCategorySearch = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

export default function PlaylistPage() {
	const router = useRouter();
	const { playlistId } = useParams() as { playlistId: string };

	const [user, setUser] = useState<AuthenticatedUser>();
	const [playlist, setPlaylist] = useState<{ id: string; ownerId: string; name: string; clipCount: number } | null>(null);
	const [isPlaylistResolved, setIsPlaylistResolved] = useState(false);
	const [playlistNameDraft, setPlaylistNameDraft] = useState("");
	const [playlistClips, setPlaylistClips] = useState<TwitchClip[]>([]);
	const [selectedPlaylistClipIds, setSelectedPlaylistClipIds] = useState<Set<string>>(new Set());
	const [cachedClips, setCachedClips] = useState<TwitchClip[]>();
	const [gameDetailsById, setGameDetailsById] = useState<Record<string, Game>>({});
	const [selectedCachedClipIds, setSelectedCachedClipIds] = useState<Selection>(new Set([]));
	const [cachedClipsFilter, setCachedClipsFilter] = useState("");
	const [, setIsLoadingCachedClips] = useState(false);
	const [cachedClipsPage, setCachedClipsPage] = useState(1);
	const ROWS_PER_PAGE = 50;
	const [cachedClipsSortDescriptor, setCachedClipsSortDescriptor] = useState<SortDescriptor>({
		column: "date",
		direction: "descending",
	});
	const [draggedClipId, setDraggedClipId] = useState<string | null>(null);
	const [dragOverClipId, setDragOverClipId] = useState<string | null>(null);

	const [importStartDate, setImportStartDate] = useState(DEFAULT_IMPORT_START_DATE);
	const [importEndDate, setImportEndDate] = useState("");
	const [importCategoryId, setImportCategoryId] = useState("all");

	useEffect(() => {
		setImportEndDate(new Date().toISOString().slice(0, 10));
	}, []);
	const [importCategoryInput, setImportCategoryInput] = useState("All categories");
	const [importMinViews, setImportMinViews] = useState(0);
	const [importMinDuration, setImportMinDuration] = useState(0);
	const [importMaxDuration, setImportMaxDuration] = useState(0);
	const [importBlacklistWords, setImportBlacklistWords] = useState<string[]>([]);
	const [importCreatorAllowlist, setImportCreatorAllowlist] = useState<string[]>([]);
	const [importCreatorDenylist, setImportCreatorDenylist] = useState<string[]>([]);
	const [gameSearchResults, setGameSearchResults] = useState<Game[]>([]);
	const [isSearchingGames, setIsSearchingGames] = useState(false);
	const [pendingImportMode, setPendingImportMode] = useState<"append" | "replace" | null>(null);
	const [savedPlaylistClipIds, setSavedPlaylistClipIds] = useState<string[]>([]);
	const gameDetailsByIdRef = useRef<Record<string, Game>>({});

	const { isOpen: isImportOpen, onOpen: onImportOpen, onClose: onImportClose, onOpenChange: onImportOpenChange } = useDisclosure();
	const { isOpen: isAddClipsOpen, onOpen: onAddClipsOpen, onOpenChange: onAddClipsOpenChange } = useDisclosure();
	const { isOpen: isAutoImportLockedOpen, onOpen: onAutoImportLockedOpen, onOpenChange: onAutoImportLockedOpenChange } = useDisclosure();

	useEffect(() => {
		gameDetailsByIdRef.current = gameDetailsById;
	}, [gameDetailsById]);

	const resolveGameDetails = useCallback(
		async (clips: TwitchClip[]) => {
			if (!user) return;
			const uniqueGameIds = Array.from(new Set(clips.map((clip) => clip.game_id).filter(Boolean)));
			const missingIds = uniqueGameIds.filter((id) => !gameDetailsByIdRef.current[id]);
			if (missingIds.length === 0) return;

			const resolved = await getGamesDetailsBulk(missingIds, user.id);

			setGameDetailsById((prev) => {
				const next = { ...prev };
				for (const game of resolved) {
					next[game.id] = {
						id: game.id,
						name: game.name || "Unknown category",
						box_art_url: game.box_art_url || "",
						igdb_id: game.igdb_id || "",
					} as Game;
				}
				return next;
			});
		},
		[user],
	);

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
		let active = true;
		async function fetchData() {
			if (!user || !playlistId) return;
			setIsPlaylistResolved(false);
			const playlists = await getAllPlaylists(user.id);
			const found = playlists?.find((p) => p.id === playlistId);
			if (active && found) {
				setPlaylist({ id: found.id, ownerId: found.ownerId, name: found.name, clipCount: found.clipCount });
				setPlaylistNameDraft(found.name);
				const clips = await getPlaylistClips(found.id);
				if (!active) return;
				setPlaylistClips(clips);
				setSavedPlaylistClipIds(clips.map((clip) => clip.id));
				await resolveGameDetails(clips);
			}
			if (active) setIsPlaylistResolved(true);
		}
		fetchData();
		return () => {
			active = false;
		};
	}, [user, playlistId, resolveGameDetails]);

	useEffect(() => {
		let timeoutId: NodeJS.Timeout;
		const normalizedInput = importCategoryInput.trim().toLowerCase();
		if (normalizedInput.length >= 1 && normalizedInput !== "all" && normalizedInput !== "all categories" && user) {
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
	}, [importCategoryInput, user]);

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

	const getGameName = useCallback(
		(gameId: string) => {
			const resolved = gameDetailsById[gameId]?.name?.trim();
			return resolved && resolved !== gameId ? resolved : "Unknown category";
		},
		[gameDetailsById],
	);

	const filteredCachedClips = useMemo(() => {
		const f = cachedClipsFilter.toLowerCase();
		return (cachedClips ?? []).filter((clip) => {
			const categoryName = getGameName(clip.game_id).toLowerCase();
			return clip.title.toLowerCase().includes(f) || clip.creator_name.toLowerCase().includes(f) || categoryName.includes(f);
		});
	}, [cachedClips, cachedClipsFilter, getGameName]);

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
	}, [filteredCachedClips, cachedClipsSortDescriptor, getGameName]);

	const canUseAutoImport = user ? getFeatureAccess(user, "advanced_filters").allowed : false;
	const isFreePlaylistLimitActive = user ? !getFeatureAccess(user, "advanced_filters").allowed : false;
	const playlistClipUsage = playlistClips.length;
	const playlistClipUsagePercent = Math.min(100, Math.round((playlistClipUsage / FREE_PLAYLIST_CLIP_LIMIT) * 100));
	const selectedIds = Array.from(selectedCachedClipIds as Set<string>);
	const selectedNewClipCount = (cachedClips ?? []).filter((clip) => selectedIds.includes(clip.id) && !playlistClips.some((existing) => existing.id === clip.id)).length;
	const wouldExceedFreeLimit = isFreePlaylistLimitActive && playlistClipUsage + selectedNewClipCount > FREE_PLAYLIST_CLIP_LIMIT;
	const isPlaylistDirty = playlistClips.map((clip) => clip.id).join(",") !== savedPlaylistClipIds.join(",");
	const isPlaylistNameDirty = playlist ? playlistNameDraft.trim() !== playlist.name : false;
	const canSavePlaylist = isPlaylistDirty || isPlaylistNameDirty;
	const navGuard = useNavigationGuard({ enabled: canSavePlaylist });

	useEffect(() => {
		setSelectedPlaylistClipIds((prev) => new Set(Array.from(prev).filter((id) => playlistClips.some((clip) => clip.id === id))));
	}, [playlistClips]);

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

	async function refreshPlaylist() {
		if (!user || !playlistId) return;
		const playlists = await getAllPlaylists(user.id);
		const found = playlists?.find((p) => p.id === playlistId);
		if (found) {
			setPlaylist({ id: found.id, ownerId: found.ownerId, name: found.name, clipCount: found.clipCount });
			setPlaylistNameDraft(found.name);
			const clips = await getPlaylistClips(found.id);
			setPlaylistClips(clips);
			setSavedPlaylistClipIds(clips.map((clip) => clip.id));
		}
	}

	async function handleOpenAddClips() {
		if (!user || !playlist) return;
		setIsLoadingCachedClips(true);
		onAddClipsOpen();
		try {
			const clips = await getCachedClipsByOwner(playlist.ownerId);
			await resolveGameDetails(clips);
			setCachedClips(clips);
			const existingPlaylistClipIds = new Set(playlistClips.map((clip) => clip.id));
			const preselectedClipIds = clips.filter((clip) => existingPlaylistClipIds.has(clip.id)).map((clip) => clip.id);
			setSelectedCachedClipIds(new Set(preselectedClipIds));
			setCachedClipsPage(1);
		} catch (error) {
			console.error("Failed to load cached clips:", error);
			addToast({ title: "Failed to load clips", color: "danger" });
			onAddClipsOpenChange();
		} finally {
			setIsLoadingCachedClips(false);
		}
	}

	const paginatedCachedClips = useMemo(() => {
		const start = (cachedClipsPage - 1) * ROWS_PER_PAGE;
		const end = start + ROWS_PER_PAGE;
		return sortedCachedClips.slice(start, end);
	}, [cachedClipsPage, sortedCachedClips]);

	const cachedClipsPagesCount = Math.ceil(sortedCachedClips.length / ROWS_PER_PAGE);

	async function handleAddSelectedClips() {
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

	async function runImport(mode: "append" | "replace") {
		if (!playlistId) return;
		try {
			const imported = await previewImportPlaylistClips(playlistId, {
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

	if (!isPlaylistResolved || !user) {
		return (
			<div className='flex h-screen w-full flex-col items-center justify-center'>
				<Spinner />
				<span>Loading playlist</span>
			</div>
		);
	}

	if (!playlist) {
		return (
			<DashboardNavbar user={user} title='Playlist Management' tagline='Manage your curated clip sets'>
				<div className='flex w-full justify-center p-4'>
					<Card className='w-full max-w-2xl'>
						<Card.Content className='flex flex-col items-center gap-4 py-10 text-center'>
							<div className='text-xl font-semibold'>Playlist not found</div>
							<div className='text-sm text-default-500'>This playlist may not exist anymore, or you might not have access.</div>
							<Button onPress={() => router.push("/dashboard")}>{<IconArrowLeft size={16} />}
								Back to Dashboard
							</Button>
						</Card.Content>
					</Card>
				</div>
			</DashboardNavbar>
		);
	}

	return (
		<DashboardNavbar user={user!} title='Playlist Management' tagline='Manage your curated clip sets'>
			<div className='flex flex-col items-center justify-center w-full p-4'>
				<Card className='w-full max-w-4xl'>
					<Card.Header className='justify-between'>
						<div className='flex items-center gap-2'>
							<Button isIconOnly variant='tertiary' onPress={() => router.push("/dashboard")}>
								<IconArrowLeft />
							</Button>
							<TextField className='min-w-[260px]'><Input value={playlistNameDraft} onChange={(event) => (setPlaylistNameDraft)(event.target.value)} placeholder='Playlist name' className='h-8 text-sm' /></TextField>
						</div>
						<div className='flex items-center gap-2'>
							<Button variant='primary' className='font-semibold px-4' onPress={handleOpenAddClips}>{<IconPlus size={18} />}
								Add Clips
							</Button>
							<Button variant='tertiary' onPress={() => {
									if (canUseAutoImport) {
										onImportOpen();
										return;
									}
									onAutoImportLockedOpen();
								}}>{<IconDownload size={16} />}
								Auto Import
							</Button>
							<Button onPress={async () => {
									if (!playlistId) return;
									const nextName = playlistNameDraft.trim();
									if (!nextName) {
										addToast({ title: "Playlist name is required", color: "danger" });
										return;
									}

									if (isPlaylistNameDirty) {
										const updated = await savePlaylist(playlistId, { name: nextName });
										if (!updated) {
											addToast({ title: "Failed to save playlist", color: "danger" });
											return;
										}
										setPlaylist((prev) => (prev ? { ...prev, name: updated.name } : prev));
										setPlaylistNameDraft(updated.name);
									}

									if (isPlaylistDirty) {
										const saved = await upsertPlaylistClips(playlistId, playlistClips, "replace");
										setPlaylistClips(saved);
										setSavedPlaylistClipIds(saved.map((clip) => clip.id));
										await refreshPlaylist();
									}

									addToast({ title: "Playlist saved", color: "success" });
								}} isDisabled={!canSavePlaylist || !playlistNameDraft.trim()} variant='primary'>{<IconDeviceFloppy size={16} />}
								Save Playlist
							</Button>
						</div>
					</Card.Header>
					<Separator />
					<Card.Content>
						{isFreePlaylistLimitActive && (
							<div className='mb-4 rounded-lg border border-default-200 bg-content2 px-3 py-2'>
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
						<div className='mb-4 text-sm text-default-500'>Reorder clips as needed. Changes are applied when you click Save Playlist.</div>
						<div className='mb-3 flex items-center gap-2'>
							<Button size='sm' variant='tertiary' onPress={() => {
									if (playlistClips.length === 0) return;
									setSelectedPlaylistClipIds(new Set(playlistClips.map((clip) => clip.id)));
								}} isDisabled={playlistClips.length === 0}>
								Select all
							</Button>
							<Button size='sm' variant='tertiary' onPress={() => setSelectedPlaylistClipIds(new Set())} isDisabled={selectedPlaylistClipIds.size === 0}>
								Clear
							</Button>
							<Button size='sm' variant='danger-soft' onPress={() => {
									if (selectedPlaylistClipIds.size === 0) return;
									setPlaylistClips((prev) => prev.filter((clip) => !selectedPlaylistClipIds.has(clip.id)));
									setSelectedPlaylistClipIds(new Set());
								}} isDisabled={selectedPlaylistClipIds.size === 0}>
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
									onDrop={async () => {
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
									className={`flex items-center gap-3 rounded border px-3 py-2 transition-colors ${draggedClipId === clip.id ? "opacity-55 border-default-300 bg-content2" : ""} ${dragOverClipId === clip.id && draggedClipId !== clip.id ? "border-primary bg-primary/10" : "border-default-200 bg-content1 hover:bg-content2"}`}
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
										<Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control></Checkbox.Content>
									</Checkbox>
									<IconGripVertical size={16} className='text-default-400 cursor-grab' />
									<Image unoptimized src={clip.thumbnail_url} alt={clip.title} width={80} height={48} className='h-12 w-20 rounded object-cover' />
									<div className='min-w-0 flex-1'>
										<div className='truncate text-sm font-medium'>{clip.title}</div>
										<div className='text-xs text-default-500'>
											{clip.creator_name} • {clip.view_count} views • {clip.duration}s
										</div>
									</div>
									<Button isIconOnly variant='danger-soft' onPress={async () => {
											const next = playlistClips.filter((c) => c.id !== clip.id);
											setPlaylistClips(next);
											setSelectedPlaylistClipIds((prev) => {
												const nextIds = new Set(prev);
												nextIds.delete(clip.id);
												return nextIds;
											});
										}}>
										<IconTrash size={18} />
									</Button>
								</li>
							))}
							{playlistClips.length === 0 && <div className='py-12 text-center text-default-400 border-2 border-dashed border-default-200 rounded-lg'>This playlist is empty. Add clips to get started!</div>}
						</ul>
					</Card.Content>
				</Card>
			</div>

			<ControlledModal isOpen={isAddClipsOpen} onOpenChange={onAddClipsOpenChange} size='lg' containerClassName='max-w-5xl' dialogClassName='max-h-[80vh]'>
					<Modal.Header className='flex flex-col gap-1'>
						<Modal.Heading>Select clips to add</Modal.Heading>
						<TextField><InputGroup><InputGroup.Prefix>{<IconSearch size={16} />}</InputGroup.Prefix><InputGroup.Input placeholder='Search by title or creator...' value={cachedClipsFilter} onChange={(event) => (setCachedClipsFilter)(event.target.value)} className='h-8 text-sm' />{cachedClipsFilter ? <CloseButton aria-label='Clear' onPress={() => (setCachedClipsFilter)("")} /> : null}</InputGroup></TextField>
					</Modal.Header>
					<Modal.Body className='overflow-y-auto'>
						<Table
							aria-label='Cached clips table'
							selectionMode='multiple'
							selectedKeys={selectedCachedClipIds}
							onSelectionChange={setSelectedCachedClipIds}
							sortDescriptor={cachedClipsSortDescriptor}
							onSortChange={setCachedClipsSortDescriptor}
							classNames={{ wrapper: "max-h-[56vh]" }}
							bottomContent={
								cachedClipsPagesCount > 1 ? (
									<div className='flex w-full justify-center gap-4 items-center'>
										<Pagination isCompact showControls showShadow color='primary' page={cachedClipsPage} total={cachedClipsPagesCount} onChange={setCachedClipsPage} />
										<div className='text-xs text-default-400'>{sortedCachedClips.length} clips total</div>
									</div>
								) : null
							}
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
							<TableBody items={paginatedCachedClips ?? []} emptyContent={cachedClips === undefined ? <span className='inline-flex items-center gap-2'><Spinner />Loading clips...</span> : <div className='text-default-400'>No clips found in cache.</div>}>
								{(item) => (
									<TableRow key={item.id}>
										<TableCell>
											<div className='flex items-center gap-2'>
												<Image unoptimized src={item.thumbnail_url} alt={item.title} width={56} height={32} className='h-8 w-14 rounded object-cover' />
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
					</Modal.Body>
					<Modal.Footer>
						{wouldExceedFreeLimit && <div className='mr-auto text-xs text-danger'>Free plan limit is {FREE_PLAYLIST_CLIP_LIMIT} clips per playlist.</div>}
						<Button variant='tertiary' onPress={onAddClipsOpenChange}>
							Cancel
						</Button>
						<Button onPress={handleAddSelectedClips} isDisabled={selectedIds.length === 0 || wouldExceedFreeLimit} variant='primary'>
							Add selected clips
						</Button>
					</Modal.Footer>
			</ControlledModal>

			<ControlledModal isOpen={isImportOpen} onOpenChange={onImportOpenChange}>
					<Modal.Header><Modal.Heading>Auto Import to Playlist</Modal.Heading></Modal.Header>
					<Modal.Body className='space-y-4'>
						<ComboBox
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
								{importCategoryInput ? <button type='button' aria-label='Clear category' onClick={() => { setImportCategoryInput(""); setImportCategoryId(""); }}>×</button> : null}
								{isSearchingGames ? <span className='px-1 text-xs text-default-500'>Loading</span> : null}
								<ComboBox.Trigger />
							</ComboBox.InputGroup>
							<ComboBox.Popover><ListBox items={importCategoryOptions}>
							{(item) => (
								<ListBox.Item id={item.id} textValue={item.name}>
									<Label className='flex items-center gap-2'>
										{item.box_art_url ? <Image unoptimized src={item.box_art_url.replace("{width}", "32").replace("{height}", "44")} alt={item.name} width={24} height={32} className='h-8 w-6 rounded object-cover' /> : null}
										<span>{item.name}</span>
									</Label>
									<ListBox.ItemIndicator />
								</ListBox.Item>
							)}
							</ListBox></ComboBox.Popover>
						</ComboBox>

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
					</Modal.Body>
					<Modal.Footer>
						<Button variant='tertiary' onPress={onImportClose}>
							Cancel
						</Button>
						<Button isDisabled={!canUseAutoImport || !playlistId || !importCategoryId} onPress={() => {
								if (playlistClips.length > 0) setPendingImportMode("append");
								else runImport("replace");
							}} variant='primary'>{<IconDownload size={16} />}
							Import
						</Button>
					</Modal.Footer>
			</ControlledModal>

			<ControlledModal isOpen={isAutoImportLockedOpen} onOpenChange={onAutoImportLockedOpenChange}>
					<Modal.Header><Modal.Heading>Auto Import Requires Pro</Modal.Heading></Modal.Header>
					<Modal.Body>
						<div className='text-sm text-default-600'>Auto import is available on Pro. Free includes one playlist with up to {FREE_PLAYLIST_CLIP_LIMIT} clips.</div>
					</Modal.Body>
					<Modal.Footer>
						<Button variant='tertiary' onPress={onAutoImportLockedOpenChange}>
							Close
						</Button>
						<Link href='/dashboard/settings' className='inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-medium bg-accent text-accent-foreground hover:bg-accent-hover'>
							Upgrade
						</Link>
					</Modal.Footer>
			</ControlledModal>

			<ControlledModal isOpen={pendingImportMode !== null} onOpenChange={() => setPendingImportMode(null)}>
					<Modal.Header><Modal.Heading>Import Behavior</Modal.Heading></Modal.Header>
					<Modal.Body>
						<div className='text-sm text-default-600'>This playlist already has clips. Do you want to replace it or append imported clips?</div>
					</Modal.Body>
					<Modal.Footer>
						<Button variant='tertiary' onPress={async () => {
								setPendingImportMode(null);
								await runImport("append");
							}}>
							Append
						</Button>
						<Button onPress={async () => {
								setPendingImportMode(null);
								await runImport("replace");
							}} variant='danger'>
							Replace
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
						<p className='text-sm text-default-700'>
							You have unsaved playlist changes. If you leave now, your draft edits will be lost.
							<br />
							<br />
							Do you want to continue without saving?
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
	);
}
