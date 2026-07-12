"use client";
import { Dropdown, Table, Checkbox, Button, RadioGroup, Radio, Chip, Separator, Tooltip, Popover, Spinner, Link, Avatar, Skeleton, Tabs, useOverlayState, TextField, InputGroup, Label, cn } from "@heroui/react";
import { notify as addToast } from "@lib/toast";
import type { Selection, SortDescriptor } from "@heroui/react";

import type { ColumnsKey } from "./data";
import type { AuthenticatedUser, Overlay, TwitchUserResponse } from "@types";
import { StatusOptions } from "@types";
import type { Key } from "@react-types/shared";

import React, { useMemo, useCallback, useState, useEffect } from "react";
import { IconAdjustmentsHorizontal, IconArrowsLeftRight, IconChevronDown, IconCirclePlus, IconCircuitChangeover, IconCrown, IconInfoCircle, IconMenuDeep, IconPencil, IconReload, IconSearch, IconTrash, IconUnlink } from "@tabler/icons-react";
import { createOverlay, createPlaylist, deleteOverlay, deletePlaylist, saveOverlay, getAllOverlays, getAllPlaylists, getEditorOverlays, getEditorAccess } from "@actions/database";
import { createRunner, deleteRunner, getAllRunners, getAllStreamSessions, unlinkRunner } from "@actions/runner";
import { validateAuth } from "@actions/auth";
import UpgradeModal from "@components/upgradeModal";
import ConfirmModal from "@components/confirmModal";
import AppPagination from "@components/appPagination";
import { getFeatureAccess, getTrialDaysLeft, isReverseTrialActive } from "@lib/featureAccess";
import { usePlausible } from "next-plausible";
import { trackPaywallEvent } from "@lib/paywallTracking";

import { CopyText } from "./copy-text";

import { useMemoizedCallback } from "./use-memoized-callback";

import { columns, INITIAL_VISIBLE_COLUMNS, INITIAL_VISIBLE_PLAYLIST_COLUMNS, INITIAL_VISIBLE_RUNNER_COLUMNS, playlistColumns, runnerColumns } from "./data";
import { Status } from "./Status";
import { useRouter, useSearchParams } from "next/navigation";
import { getAvatar, getUsersDetailsBulk } from "@actions/twitch";

const dashboardTabs = new Set(["overlays", "playlists", "runners"]);

export default function OverlayTable({ userId, accessToken }: { userId: string; accessToken: string }) {
	const router = useRouter();
	const searchParams = useSearchParams();
	type LocalOverlay = Overlay & { accessType?: "owner" | "editor" };
	type LocalPlaylist = { id: string; ownerId: string; name: string; clipCount: number; accessType?: "owner" | "editor" };
	type LocalRunner = { id: string; ownerId: string; name: string; status: string; createdAt: Date; lastHeartbeatAt: Date | null; streamState?: string; streamError?: string | null; isLinked?: boolean };

	const [overlays, setOverlays] = useState<LocalOverlay[]>();
	const [playlists, setPlaylists] = useState<LocalPlaylist[]>();
	const [runners, setRunners] = useState<LocalRunner[]>();
	const [activeTab, setActiveTab] = useState<"overlays" | "playlists" | "runners">(() => {
		const tab = searchParams.get("tab");
		return dashboardTabs.has(tab ?? "") ? (tab as "overlays" | "playlists" | "runners") : "overlays";
	});
	const [filterValue, setFilterValue] = useState("");
	const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set([]));
	const [visibleOverlayColumns, setVisibleOverlayColumns] = useState<Selection>(new Set(INITIAL_VISIBLE_COLUMNS));
	const [visiblePlaylistColumns, setVisiblePlaylistColumns] = useState<Selection>(new Set(INITIAL_VISIBLE_PLAYLIST_COLUMNS));
	const [visibleRunnerColumns, setVisibleRunnerColumns] = useState<Selection>(new Set(INITIAL_VISIBLE_RUNNER_COLUMNS));
	const [rowsPerPage] = useState(10);
	const [page, setPage] = useState(1);
	const [isLoading, setIsLoading] = useState(false);
	const [hasAccess, setHasAccess] = useState<boolean>(false);
	const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
	const [editorAccessList, setEditorAccessList] = useState<Set<TwitchUserResponse>>(new Set());
	const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
		column: "name",
		direction: "ascending",
	});
	const [deleteRequest, setDeleteRequest] = useState<null | { kind: "overlay" | "playlist" | "runner"; id: string; name: string }>(null);
	const [unlinkRequest, setUnlinkRequest] = useState<null | { kind: "runner"; ids: string[]; name: string }>(null);
	const { isOpen: isUpgradeOpen, open: onUpgradeOpen, setOpen: onUpgradeOpenChange } = useOverlayState();
	const plausible = usePlausible();

	const [statusFilter, setStatusFilter] = React.useState("all");
	const [runnerLinkFilter, setRunnerLinkFilter] = React.useState("all");

	const onTabChange = useCallback((key: React.Key) => {
		setActiveTab(key as "overlays" | "playlists" | "runners");
		setFilterValue("");
		setSelectedKeys(new Set([]));
		setPage(1);
		setSortDescriptor({
			column: "name",
			direction: "ascending",
		});
	}, []);

	const visibleColumns = activeTab === "overlays" ? visibleOverlayColumns : activeTab === "playlists" ? visiblePlaylistColumns : visibleRunnerColumns;
	const setVisibleColumns = activeTab === "overlays" ? setVisibleOverlayColumns : activeTab === "playlists" ? setVisiblePlaylistColumns : setVisibleRunnerColumns;
	const currentColumns = activeTab === "overlays" ? columns : activeTab === "playlists" ? playlistColumns : runnerColumns;

	useEffect(() => {
		async function fetchOverlays() {
			try {
				const overlaysData = await getAllOverlays(userId);
				const playlistsData = await getAllPlaylists(userId);
				const runnersData = await getAllRunners(userId);
				const streamSessionsData = await getAllStreamSessions(userId);
				const editorOverlays = await getEditorOverlays(userId);

				const combinedOverlays: LocalOverlay[] = [...(overlaysData ?? []).map((o) => ({ ...o, accessType: "owner" as const })), ...(editorOverlays ?? []).map((o) => ({ ...o, accessType: "editor" as const }))];
				const combinedPlaylists: LocalPlaylist[] = (playlistsData ?? []).map((playlist) => ({
					id: playlist.id,
					name: playlist.name,
					ownerId: playlist.ownerId,
					clipCount: playlist.clipCount,
					accessType: playlist.accessType,
				}));
				const combinedRunners: LocalRunner[] = (runnersData ?? []).map((r) => {
					const session = streamSessionsData?.find((s) => s.runnerId === r.id);
					return { ...r, streamState: session?.actualState, streamError: session?.lastError };
				});

				setOverlays(combinedOverlays ?? undefined);
				setPlaylists(combinedPlaylists ?? undefined);
				setRunners(combinedRunners ?? undefined);
			} catch (error) {
				console.error("Failed to fetch overlays:", error);
			}
		}

		async function fetchEditorAccess() {
			const editors = await getEditorAccess(userId);
			if (editors && editors.length > 0) {
				setHasAccess(true);

				const editorDetails = await getUsersDetailsBulk({ userIds: [userId, ...editors.map((e) => e.userId)], accessToken });

				setEditorAccessList(new Set(editorDetails));
			} else {
				setHasAccess(false);
			}
		}

		fetchOverlays();
		fetchEditorAccess();
	}, [accessToken, userId]);

	useEffect(() => {
		async function fetchUser() {
			const user = await validateAuth();
			if (user) setCurrentUser(user);
		}
		fetchUser();
	}, []);

	useEffect(() => {
		if (!currentUser) return;
		const effectivePlan = currentUser.entitlements?.effectivePlan ?? currentUser.plan;
		if (effectivePlan !== "free") return;

		if (activeTab === "overlays") {
			const ownerOverlaysCount = overlays?.filter((o) => o.ownerId === userId).length ?? 0;
			if (ownerOverlaysCount < 1) return;
			if (getFeatureAccess(currentUser, "multi_overlay").allowed) return;
			trackPaywallEvent(plausible, "paywall_impression", {
				source: "paywall_banner",
				feature: "multi_overlay",
				plan: currentUser.plan,
				overlay_count: ownerOverlaysCount,
			});
		} else {
			const ownerPlaylistsCount = playlists?.filter((p) => p.ownerId === userId).length ?? 0;
			if (ownerPlaylistsCount < 1) return;
			if (getFeatureAccess(currentUser, "multi_playlist").allowed) return;
			trackPaywallEvent(plausible, "paywall_impression", {
				source: "paywall_banner",
				feature: "multi_playlist",
				plan: currentUser.plan,
				playlist_count: ownerPlaylistsCount,
			});
		}
	}, [currentUser, overlays, playlists, plausible, userId, activeTab]);

	// Plan is available on currentUser; avoid extra fetch.

	const headerColumns = useMemo(() => {
		const cols = currentColumns as { name: string; uid: string; info?: string; sortDirection?: string }[];
		if (visibleColumns === "all") return cols;

		return cols
			.map((item) => {
				if (item.uid === sortDescriptor.column) {
					return {
						...item,
						sortDirection: sortDescriptor.direction,
					};
				}

				return item;
			})
			.filter((column) => Array.from(visibleColumns).includes(column.uid));
	}, [visibleColumns, sortDescriptor, currentColumns]);
	const rowHeaderColumn = headerColumns.find((column) => column.uid === "name")?.uid ?? headerColumns.find((column) => column.uid === "id")?.uid ?? headerColumns.find((column) => column.uid !== "actions")?.uid;

	const itemFilter = useCallback(
		(col: Overlay | LocalPlaylist | LocalRunner) => {
			if (activeTab === "overlays") {
				const overlay = col as Overlay;
				const allStatus = statusFilter === "all";
				return allStatus || statusFilter === overlay.status.toLowerCase();
			}
			if (activeTab === "runners") {
				const runner = col as LocalRunner;
				if (runnerLinkFilter === "linked") return Boolean(runner.lastHeartbeatAt);
				if (runnerLinkFilter === "not_linked") return !runner.lastHeartbeatAt;
			}
			return true;
		},
		[statusFilter, activeTab, runnerLinkFilter],
	);

	const filteredItems = useMemo(() => {
		const rawItems = activeTab === "overlays" ? overlays || [] : activeTab === "playlists" ? playlists || [] : runners || [];
		let filtered = [...rawItems];

		if (filterValue) {
			filtered = filtered.filter((item) => item.name.toLowerCase().includes(filterValue.toLowerCase()));
		}

		filtered = filtered.filter(itemFilter);

		return filtered;
	}, [filterValue, overlays, playlists, runners, itemFilter, activeTab]);

	const pages = Math.ceil(filteredItems.length / rowsPerPage) || 1;

	const items = useMemo(() => {
		const start = (page - 1) * rowsPerPage;
		const end = start + rowsPerPage;

		return filteredItems.slice(start, end);
	}, [page, filteredItems, rowsPerPage]);

	const sortedItems = useMemo(() => {
		return [...items].sort((a: LocalOverlay | LocalPlaylist | LocalRunner, b: LocalOverlay | LocalPlaylist | LocalRunner) => {
			const col = sortDescriptor.column as keyof (LocalOverlay | LocalPlaylist | LocalRunner);

			const first = (a as Record<string, unknown>)[col];
			const second = (b as Record<string, unknown>)[col];

			const safeFirst = (first as string | number | undefined) ?? "";
			const safeSecond = (second as string | number | undefined) ?? "";
			const cmp = safeFirst < safeSecond ? -1 : safeFirst > safeSecond ? 1 : 0;

			return sortDescriptor.direction === "descending" ? -cmp : cmp;
		});
	}, [sortDescriptor, items]);

	const filterSelectedKeys = useMemo(() => {
		if (selectedKeys === "all") return selectedKeys;
		let resultKeys = new Set<Key>();

		if (filterValue) {
			filteredItems.forEach((item) => {
				const stringId = String(item.id);

				if ((selectedKeys as Set<string>).has(stringId)) {
					resultKeys.add(stringId);
				}
			});
		} else {
			resultKeys = selectedKeys;
		}

		return resultKeys;
	}, [selectedKeys, filteredItems, filterValue]);

	const renderCell = useCallback(
		(item: LocalOverlay | LocalPlaylist | LocalRunner, columnKey: React.Key) => {
			const key = columnKey as ColumnsKey;

			if (activeTab === "overlays") {
				const overlay = item as LocalOverlay;
				const cellValue = overlay[key as unknown as keyof Overlay] as string;

				switch (key) {
					case "accessType":
						return <AvatarCell ownerId={overlay.ownerId} userId={userId} />;
					case "name":
						return <CopyText>{cellValue}</CopyText>;
					case "id":
						return <CopyText textClassName='whitespace-nowrap'>{cellValue}</CopyText>;
					case "status":
						return <Status status={cellValue as StatusOptions} />;
					case "actions":
						return (
							<div className='flex items-center justify-end gap-2'>
								<IconPencil className='cursor-pointer text-muted' height={18} width={18} />
								<IconTrash
									className='cursor-pointer text-muted'
									height={18}
									width={18}
									onClick={(event) => {
										event.stopPropagation();
										setDeleteRequest({ kind: "overlay", id: overlay.id, name: overlay.name });
									}}
								/>
							</div>
						);
					default:
						return cellValue;
				}
			} else if (activeTab === "playlists") {
				const playlist = item as LocalPlaylist;
				switch (key) {
					case "id":
						return <CopyText textClassName='whitespace-nowrap'>{playlist.id}</CopyText>;
					case "name":
						return <div className='font-semibold'>{playlist.name}</div>;
					case "clipCount":
						return <div>{playlist.clipCount} clips</div>;
					case "accessType":
						return <AvatarCell ownerId={playlist.ownerId} userId={userId} />;
					case "actions":
						return (
							<div className='flex items-center justify-end gap-2'>
								<IconTrash
									className='cursor-pointer text-muted'
									height={18}
									width={18}
									onClick={(event) => {
										event.stopPropagation();
										setDeleteRequest({ kind: "playlist", id: playlist.id, name: playlist.name });
									}}
								/>
							</div>
						);
					default:
						return (playlist as Record<string, unknown>)[key] as React.ReactNode;
				}
			} else {
				const runner = item as LocalRunner;
				switch (key) {
					case "id":
						return <CopyText textClassName='whitespace-nowrap'>{runner.id}</CopyText>;
					case "name":
						return <div className='font-semibold'>{runner.name}</div>;
					case "status":
						let statusText = "Offline";
						let color: "default" | "success" | "danger" = "default";

						if (runner.status === "online") {
							if (runner.streamState === "running") {
								statusText = "Streaming";
								color = "danger";
							} else {
								statusText = "Online";
								color = "success";
							}
						}

						return (
							<div className='flex items-center gap-2'>
								<Chip color={color} variant='soft' size='sm'>
									{statusText}
								</Chip>
								{runner.streamError && (
									<Chip color='warning' variant='soft' size='sm'>
										Error
									</Chip>
								)}
							</div>
						);
					case "linked":
						return runner.lastHeartbeatAt ? (
							<Chip color='success' variant='soft' size='sm'>
								Linked
							</Chip>
						) : (
							<Chip color='default' variant='soft' size='sm'>
								Not linked
							</Chip>
						);
					case "actions":
						return (
							<div className='flex items-center justify-end gap-2'>
								<IconTrash
									className='cursor-pointer text-danger transition-opacity hover:opacity-80'
									height={18}
									width={18}
									onClick={(event) => {
										event.stopPropagation();
										setDeleteRequest({ kind: "runner", id: runner.id, name: runner.name });
									}}
								/>
							</div>
						);
					default:
						return (runner as Record<string, unknown>)[key] as React.ReactNode;
				}
			}
		},
		[activeTab, userId],
	);

	const onNextPage = useMemoizedCallback(() => {
		if (page < pages) {
			setPage(page + 1);
		}
	});

	const onPreviousPage = useMemoizedCallback(() => {
		if (page > 1) {
			setPage(page - 1);
		}
	});

	const onSearchChange = useMemoizedCallback((value?: string) => {
		if (value) {
			setFilterValue(value);
			setPage(1);
		} else {
			setFilterValue("");
		}
	});

	const onSelectionChange = useMemoizedCallback((keys: Selection) => {
		if (keys === "all") {
			if (filterValue) {
				const resultKeys = new Set(filteredItems.map((item) => String(item.id)));

				setSelectedKeys(resultKeys);
			} else {
				setSelectedKeys(keys);
			}
		} else if (keys.size === 0) {
			setSelectedKeys(new Set());
		} else {
			const resultKeys = new Set<Key>();

			keys.forEach((v) => {
				resultKeys.add(v);
			});
			const selectedValue = selectedKeys === "all" ? new Set(filteredItems.map((item) => String(item.id))) : selectedKeys;

			selectedValue.forEach((v) => {
				if (items.some((item) => String(item.id) === v)) {
					return;
				}
				resultKeys.add(v);
			});
			setSelectedKeys(new Set(resultKeys));
		}
	});

	const reloadOverlays = useMemoizedCallback(async () => {
		const overlaysData = await getAllOverlays(userId);
		const playlistsData = await getAllPlaylists(userId);
		const runnersData = await getAllRunners(userId);
		const streamSessionsData = await getAllStreamSessions(userId);
		const editorOverlays = await getEditorOverlays(userId);

		const combinedOverlays: LocalOverlay[] = [...(overlaysData ?? []).map((o) => ({ ...o, accessType: "owner" as const })), ...(editorOverlays ?? []).map((o) => ({ ...o, accessType: "editor" as const }))];
		const combinedPlaylists: LocalPlaylist[] = (playlistsData ?? []).map((playlist) => ({
			id: playlist.id,
			name: playlist.name,
			ownerId: playlist.ownerId,
			clipCount: playlist.clipCount,
			accessType: playlist.accessType,
		}));
		const combinedRunners: LocalRunner[] = (runnersData ?? []).map((r) => {
			const session = streamSessionsData?.find((s) => s.runnerId === r.id);
			return { ...r, streamState: session?.actualState, streamError: session?.lastError };
		});

		setOverlays(combinedOverlays ?? undefined);
		setPlaylists(combinedPlaylists ?? undefined);
		setRunners(combinedRunners ?? undefined);
	});

	const confirmDelete = useMemoizedCallback(async () => {
		if (!deleteRequest) return;

		try {
			if (deleteRequest.kind === "overlay") {
				const deleted = await deleteOverlay(deleteRequest.id);
				if (!deleted) throw new Error("Failed to delete overlay");
				setOverlays((prev) => (prev ? prev.filter((o) => o.id !== deleteRequest.id) : []));
				addToast({ title: "Successfully deleted", description: `Overlay "${deleteRequest.name}" has been deleted.`, color: "success" });
			} else if (deleteRequest.kind === "playlist") {
				const deleted = await deletePlaylist(deleteRequest.id);
				if (!deleted) throw new Error("Failed to delete playlist");
				setPlaylists((prev) => (prev ? prev.filter((p) => p.id !== deleteRequest.id) : []));
				addToast({ title: "Playlist deleted", description: `Playlist "${deleteRequest.name}" has been deleted.`, color: "success" });
			} else {
				const result = await deleteRunner(deleteRequest.id, userId);
				if (!result.success) throw new Error(result.error || "Failed to delete runner");
				setRunners((prev) => (prev ? prev.filter((r) => r.id !== deleteRequest.id) : []));
				addToast({ title: "Runner deleted", description: `Runner "${deleteRequest.name}" has been deleted.`, color: "success" });
			}
			setDeleteRequest(null);
		} catch (error) {
			addToast({
				title: "Error",
				description: error instanceof Error ? error.message : "An error occurred while deleting the item.",
				color: "danger",
			});
		}
	});

	const confirmUnlink = useMemoizedCallback(async () => {
		if (!unlinkRequest) return;

		try {
			const results = await Promise.all(unlinkRequest.ids.map((runnerId) => unlinkRunner(runnerId, userId)));
			const failed = results.filter((result) => !result.success);
			if (failed.length > 0) {
				throw new Error(failed[0]?.error || "Failed to unlink one or more runners");
			}

			setRunners((prev) =>
				prev
					? prev.map((runner) =>
							unlinkRequest.ids.includes(runner.id)
								? {
										...runner,
										status: "offline",
										lastHeartbeatAt: null,
										streamState: "stopped",
										streamError: runner.streamError,
									}
								: runner,
						)
					: [],
			);
			addToast({
				title: "Runner unlinked",
				description: `${unlinkRequest.ids.length} runner${unlinkRequest.ids.length > 1 ? "s" : ""} have been unlinked.`,
				color: "success",
			});
			setUnlinkRequest(null);
		} catch (error) {
			addToast({
				title: "Error",
				description: error instanceof Error ? error.message : "An error occurred while unlinking the runners.",
				color: "danger",
			});
		}
	});

	const openBulkUnlink = useMemoizedCallback(() => {
		const selectedRunners = filterSelectedKeys === "all" ? runners : (filteredItems as LocalRunner[]).filter((item) => filterSelectedKeys.has(String(item.id)));
		const unlinkable = selectedRunners?.filter((runner) => runner.lastHeartbeatAt) ?? [];
		if (unlinkable.length === 0) {
			addToast({
				title: "Nothing to unlink",
				description: "Select one or more connected runners first.",
				color: "warning",
			});
			return;
		}

		setUnlinkRequest({
			kind: "runner",
			ids: unlinkable.map((runner) => runner.id),
			name: unlinkable.length === 1 ? unlinkable[0].name : `${unlinkable.length} runners`,
		});
	});

	const topContent = useMemo(() => {
		return (
			<div className='flex flex-wrap items-center gap-2 py-3'>
				<div className='flex min-w-0 flex-wrap items-center gap-2'>
					<div className='flex min-w-0 flex-wrap items-center gap-2'>
						<TextField className='min-w-0 flex-1 sm:min-w-[200px] sm:max-w-xs'>
							<InputGroup variant='secondary'>
								<InputGroup.Input placeholder='Search' value={filterValue} onChange={(event) => onSearchChange(event.target.value)} />
								<InputGroup.Suffix>{<IconSearch className='text-muted' width={16} />}</InputGroup.Suffix>
							</InputGroup>
						</TextField>
						{activeTab === "overlays" && (
							<Popover>
								<Button variant='tertiary' size='sm' aria-label='Open Filter Options'>
									<IconAdjustmentsHorizontal className='text-muted' width={16} />
									Filter
								</Button>
								<Popover.Content placement='bottom start'>
									<Popover.Dialog className='min-w-44'>
										<RadioGroup variant='secondary' value={statusFilter} onChange={setStatusFilter}>
											<Label>Status</Label>
											<Radio value='all'>
												<Radio.Content>
													<Radio.Control>
														<Radio.Indicator />
													</Radio.Control>
													All
												</Radio.Content>
											</Radio>
											<Radio value='active'>
												<Radio.Content>
													<Radio.Control>
														<Radio.Indicator />
													</Radio.Control>
													Active
												</Radio.Content>
											</Radio>
											<Radio value='paused'>
												<Radio.Content>
													<Radio.Control>
														<Radio.Indicator />
													</Radio.Control>
													Paused
												</Radio.Content>
											</Radio>
										</RadioGroup>
									</Popover.Dialog>
								</Popover.Content>
							</Popover>
						)}
						{activeTab === "runners" && (
							<Popover>
								<Button variant='tertiary' size='sm' className='text-foreground' aria-label='Open Filter Options'>
									<IconAdjustmentsHorizontal className='text-muted' width={16} />
									Filter
								</Button>
								<Popover.Content placement='bottom start'>
									<Popover.Dialog className='min-w-44'>
										<RadioGroup variant='secondary' value={runnerLinkFilter} onChange={setRunnerLinkFilter}>
											<Label>Linked status</Label>
											<Radio value='all'>
												<Radio.Content>
													<Radio.Control>
														<Radio.Indicator />
													</Radio.Control>
													All
												</Radio.Content>
											</Radio>
											<Radio value='linked'>
												<Radio.Content>
													<Radio.Control>
														<Radio.Indicator />
													</Radio.Control>
													Linked
												</Radio.Content>
											</Radio>
											<Radio value='not_linked'>
												<Radio.Content>
													<Radio.Control>
														<Radio.Indicator />
													</Radio.Control>
													Not linked
												</Radio.Content>
											</Radio>
										</RadioGroup>
									</Popover.Dialog>
								</Popover.Content>
							</Popover>
						)}
						<Dropdown>
							<Button variant='tertiary' size='sm' aria-label='Open Sort Options'>
								<IconMenuDeep className='text-muted' width={16} />
								Sort
							</Button>
							<Dropdown.Popover>
								<Dropdown.Menu aria-label='Sort' items={headerColumns.filter((column) => column.uid !== "actions" && column.name !== "")} selectedKeys={new Set([String(sortDescriptor.column)])} selectionMode='single'>
									{(item) => (
										<Dropdown.Item
											key={item.uid}
											id={item.uid}
											textValue={item.name}
											onAction={() => {
												setSortDescriptor({
													column: item.uid,
													direction: sortDescriptor.column === item.uid && sortDescriptor.direction === "ascending" ? "descending" : "ascending",
												});
											}}
										>
											<Dropdown.ItemIndicator />
											<Label>{item.name}</Label>
										</Dropdown.Item>
									)}
								</Dropdown.Menu>
							</Dropdown.Popover>
						</Dropdown>
						<Dropdown>
							<Button variant='tertiary' size='sm' aria-label='Open Column Options'>
								<IconArrowsLeftRight className='text-muted' width={16} />
								Columns
							</Button>
							<Dropdown.Popover>
								<Dropdown.Menu disallowEmptySelection aria-label='Columns' items={currentColumns.filter((column) => column.uid !== "actions" && column.name !== "")} selectedKeys={visibleColumns} selectionMode='multiple' onSelectionChange={setVisibleColumns}>
									{(item) => (
										<Dropdown.Item key={item.uid} id={item.uid} textValue={item.name}>
											<Dropdown.ItemIndicator />
											<Label>{item.name}</Label>
										</Dropdown.Item>
									)}
								</Dropdown.Menu>
							</Dropdown.Popover>
						</Dropdown>
					</div>

					<Separator className='h-5' orientation='vertical' />

					<div className='whitespace-nowrap text-sm text-foreground'>{filterSelectedKeys === "all" ? "All items selected" : `${filterSelectedKeys.size} Selected`}</div>

					{(filterSelectedKeys === "all" || filterSelectedKeys.size > 0) && (
						<Dropdown>
							<Button variant='tertiary' size='sm' aria-label='Open Selected Actions'>
								Selected Actions
								<IconChevronDown className='text-muted' />
							</Button>
							<Dropdown.Popover>
								<Dropdown.Menu aria-label='Selected Actions'>
									{activeTab === "overlays" ? (
										<Dropdown.Item
											id='toggleStatus'
											textValue='Toggle status'
											onAction={() => {
												const selectedOverlays = filterSelectedKeys === "all" ? overlays : (filteredItems as LocalOverlay[]).filter((item) => filterSelectedKeys.has(String(item.id)));

												const toggleStatusPromises = selectedOverlays?.map((overlay) => {
													const newStatus: StatusOptions = overlay.status === StatusOptions.Active ? StatusOptions.Paused : StatusOptions.Active;
													return saveOverlay(overlay.id, { status: newStatus }).then((updated) => ({
														ok: Boolean(updated),
														id: overlay.id,
														status: newStatus,
													}));
												});

												Promise.all(toggleStatusPromises ?? [])
													.then((results) => {
														const failed = results.filter((r) => !r.ok);
														if (failed.length > 0) {
															addToast({
																title: "Error",
																description: "One or more overlays could not be updated.",
																color: "danger",
															});
															return;
														}

														setOverlays((prev) =>
															prev
																? prev.map((o) => {
																		const match = results.find((r) => r.id === o.id && r.ok);
																		return match ? { ...o, status: match.status } : o;
																	})
																: [],
														);
														addToast({
															title: "Status Updated",
															description: `${selectedOverlays?.length ?? 0} Overlay${(selectedOverlays?.length ?? 0) > 1 ? "s" : ""} status have been updated.`,
															color: "success",
														});
													})
													.catch(() => {
														addToast({
															title: "Error",
															description: "An error occurred while updating the status of one or more overlays.",
															color: "danger",
														});
													});
											}}
										>
											<IconCircuitChangeover />
											<Label>Toggle status</Label>
										</Dropdown.Item>
									) : null}
									{activeTab === "runners" ? (
										<Dropdown.Item id='unlink' textValue='Unlink' variant='default' onAction={openBulkUnlink}>
											<IconUnlink className='text-muted' width={16} />
											<Label>Unlink</Label>
										</Dropdown.Item>
									) : null}
									<Dropdown.Item
										id='delete'
										textValue='Delete'
										variant='danger'
										onAction={() => {
											const selectedItems = filterSelectedKeys === "all" ? (activeTab === "overlays" ? overlays : playlists) : filteredItems.filter((item) => filterSelectedKeys.has(String(item.id)));

											const deletePromises = selectedItems?.map((item) =>
												(activeTab === "overlays" ? deleteOverlay(item.id) : deletePlaylist(item.id)).then((ok) => ({
													ok: Boolean(ok),
													id: item.id,
												})),
											);

											Promise.all(deletePromises ?? [])
												.then((results) => {
													const failed = results.filter((r) => !r.ok);
													if (failed.length > 0) {
														addToast({
															title: "Error",
															description: `One or more ${activeTab} could not be deleted.`,
															color: "danger",
														});
														return;
													}

													if (activeTab === "overlays") {
														setOverlays((prev) => (prev ? prev.filter((o) => !results.some((r) => r.ok && r.id === o.id)) : []));
													} else {
														setPlaylists((prev) => (prev ? prev.filter((p) => !results.some((r) => r.ok && r.id === p.id)) : []));
													}
													setSelectedKeys(new Set([]));
													addToast({
														title: "Successfully deleted",
														description: `${selectedItems?.length ?? 0} ${activeTab === "overlays" ? "Overlay" : "Playlist"}${(selectedItems?.length ?? 0) > 1 ? "s" : ""} have been deleted.`,
														color: "success",
													});
												})
												.catch(() => {
													addToast({
														title: "Error",
														description: `An error occurred while deleting one or more ${activeTab}.`,
														color: "danger",
													});
												});
										}}
									>
										<IconTrash className='text-danger' width={16} />
										<Label>Delete</Label>
									</Dropdown.Item>
								</Dropdown.Menu>
							</Dropdown.Popover>
						</Dropdown>
					)}
				</div>
			</div>
		);
	}, [filterValue, visibleColumns, filterSelectedKeys, headerColumns, sortDescriptor, statusFilter, setStatusFilter, onSearchChange, setVisibleColumns, filteredItems, overlays, activeTab, currentColumns, playlists]);

	const topBar = useMemo(() => {
		const ownerOverlaysCount = overlays?.filter((o) => o.ownerId === userId).length ?? 0;
		const ownerPlaylistsCount = playlists?.filter((p) => p.ownerId === userId).length ?? 0;
		const multiOverlayAccess = currentUser ? getFeatureAccess(currentUser, "multi_overlay") : { allowed: false as const };
		const multiPlaylistAccess = currentUser ? getFeatureAccess(currentUser, "multi_playlist") : { allowed: false as const };
		const inTrial = currentUser ? isReverseTrialActive(currentUser) : false;
		const trialDaysLeft = currentUser ? getTrialDaysLeft(currentUser) : 0;
		const effectivePlan = currentUser?.entitlements?.effectivePlan ?? currentUser?.plan ?? "free";
		return (
			<div className='mb-[12px]'>
				<div className='flex items-center justify-between'>
					<div className='flex w-[226px] items-center gap-2'>
						<h1 className='text-2xl font-[700] leading-[32px]'>{activeTab === "overlays" ? "Overlays" : activeTab === "playlists" ? "Playlists" : "Runners"}</h1>
						<Chip className='hidden items-center text-muted sm:flex' size='sm' variant='tertiary'>
							{activeTab === "overlays" ? (overlays?.length ?? 0) : activeTab === "playlists" ? (playlists?.length ?? 0) : (runners?.length ?? 0)}
						</Chip>
						<Button isIconOnly size='sm' variant='tertiary' onPress={reloadOverlays} aria-label='Reload'>
							{<IconReload className='text-muted' width={16} />}
						</Button>
					</div>
					{hasAccess ? (
						<Dropdown>
							<Button variant='primary' isDisabled={overlays === undefined} isPending={isLoading}>
								{isLoading ? <Spinner color='current' size='sm' /> : null}
								{activeTab === "overlays" ? "Add Overlay" : activeTab === "playlists" ? "Add Playlist" : "Add Runner"}
								<IconCirclePlus width={20} />
							</Button>

							<Dropdown.Popover>
								<Dropdown.Menu aria-label='Actions' items={editorAccessList}>
									{(item) => (
										<Dropdown.Item
											key={item.id}
											id={item.id}
											textValue={activeTab === "overlays" ? `Add new overlay for ${item.display_name}` : activeTab === "playlists" ? `Add new playlist for ${item.display_name}` : `Add new runner for ${item.display_name}`}
											onAction={async () => {
												setIsLoading(true);
												try {
													if (activeTab === "overlays") {
														const overlay = await createOverlay(item.id);
														if (!overlay) {
															addToast({
																title: "Error",
																description: "Failed to create overlay. The owner may be on the Free plan or you lack permissions.",
																color: "danger",
															});
															if (currentUser?.id === item.id) {
																onUpgradeOpen();
															}
															return;
														}
														router.push(`/dashboard/overlay/${overlay.id}`);
														return;
													}

													if (activeTab === "runners") {
														if (currentUser?.id === item.id && !currentUser.entitlements?.runnerAccess) {
															onUpgradeOpen();
															return;
														}
														const newRunner = await createRunner(item.id, "New Hardware Node");
														if (!newRunner.success) {
															addToast({
																title: "Error",
																description: "Failed to create runner.",
																color: "danger",
															});
															return;
														}
														router.push(`/dashboard/runners/${newRunner.runner?.id}`);
														return;
													}

													const playlist = await createPlaylist(item.id, `Playlist ${ownerPlaylistsCount + 1}`);
													if (!playlist) {
														addToast({
															title: "Error",
															description: "Failed to create playlist.",
															color: "danger",
														});
														return;
													}
													router.push(`/dashboard/playlist/${playlist.id}`);
												} catch {
													addToast({
														title: "Error",
														description: activeTab === "overlays" ? "Failed to create overlay. Please try again." : activeTab === "playlists" ? "Failed to create playlist. Please try again." : "Failed to create runner. Please try again.",
														color: "danger",
													});
												} finally {
													setIsLoading(false);
												}
											}}
										>
											<Label className='flex items-center'>
												<Avatar className='mr-2 h-6 w-6'>
													<Avatar.Image alt={item.display_name} src={item.profile_image_url} />
													<Avatar.Fallback>{item.display_name.slice(0, 2).toUpperCase()}</Avatar.Fallback>
												</Avatar>
												{activeTab === "overlays" ? `Add new overlay for ${item.display_name}` : activeTab === "playlists" ? `Add new playlist for ${item.display_name}` : `Add new runner for ${item.display_name}`}
											</Label>
										</Dropdown.Item>
									)}
								</Dropdown.Menu>
							</Dropdown.Popover>
						</Dropdown>
					) : (
						<Button
							isPending={isLoading}
							isDisabled={overlays === undefined}
							onPress={async () => {
								if (activeTab === "runners") {
									if (!currentUser?.entitlements?.runnerAccess) {
										onUpgradeOpen();
										return;
									}
									setIsLoading(true);
									try {
										const newRunner = await createRunner(userId, "New Hardware Node");
										if (!newRunner.success) {
											addToast({
												title: "Error",
												description: "Failed to create runner.",
												color: "danger",
											});
											return;
										}
										router.push(`/dashboard/runners/${newRunner.runner?.id}`);
									} catch {
										addToast({
											title: "Error",
											description: "Failed to create runner. Please try again.",
											color: "danger",
										});
									} finally {
										setIsLoading(false);
									}
									return;
								}
								setIsLoading(true);

								if (activeTab === "overlays" && effectivePlan === "free" && ownerOverlaysCount >= 1 && !multiOverlayAccess.allowed) {
									trackPaywallEvent(plausible, "paywall_cta_click", {
										source: "paywall_banner",
										feature: "multi_overlay",
										plan: currentUser?.plan ?? "free",
									});
									addToast({
										title: "Upgrade Required",
										description: (
											<p>
												To add an additional overlay, please{" "}
												<Link className='text-warning underline underline-offset-2' href='/dashboard/settings'>
													upgrade
												</Link>{" "}
												to <strong>Pro</strong>.
											</p>
										),
										color: "warning",
									});
									onUpgradeOpen();
									setIsLoading(false);
									return;
								}

								if (activeTab === "playlists" && effectivePlan === "free" && ownerPlaylistsCount >= 1 && !multiPlaylistAccess.allowed) {
									trackPaywallEvent(plausible, "paywall_cta_click", {
										source: "paywall_banner",
										feature: "multi_playlist",
										plan: currentUser?.plan ?? "free",
									});
									addToast({
										title: "Upgrade Required",
										description: (
											<p>
												To add an additional playlist, please{" "}
												<Link className='text-warning underline underline-offset-2' href='/dashboard/settings'>
													upgrade
												</Link>{" "}
												to <strong>Pro</strong>.
											</p>
										),
										color: "warning",
									});
									onUpgradeOpen();
									setIsLoading(false);
									return;
								}

								if (activeTab === "overlays") {
									createOverlay(userId).then((overlay) => {
										if (!overlay) {
											addToast({
												title: "Error",
												description: "Failed to create overlay. Please try again.",
												color: "danger",
											});
											onUpgradeOpen();
											setIsLoading(false);
											return;
										}
										router.push(`/dashboard/overlay/${overlay.id}`);
									});
									return;
								}

								createPlaylist(userId, `Playlist ${ownerPlaylistsCount + 1}`)
									.then(async (playlist) => {
										if (!playlist) {
											addToast({
												title: "Error",
												description: "Failed to create playlist. Please try again.",
												color: "danger",
											});
											setIsLoading(false);
											return;
										}
										router.push(`/dashboard/playlist/${playlist.id}`);
									})
									.catch(() => {
										addToast({
											title: "Error",
											description: "Failed to create playlist. Please try again.",
											color: "danger",
										});
										setIsLoading(false);
									});
							}}
							variant='primary'
						>
							{isLoading ? <Spinner color='current' size='sm' /> : null}
							{activeTab === "overlays" ? "Add Overlay" : "Add Playlist"}
							{<IconCirclePlus width={20} />}
						</Button>
					)}
				</div>
				{currentUser?.plan === "free" && inTrial && (
					<div className='mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/45 bg-gradient-to-r from-amber-500/20 to-orange-500/15 px-4 py-3 text-sm text-amber-50 shadow-sm'>
						<div className='flex items-center gap-2'>
							<IconCrown size={16} className='text-amber-200' />
							<span>
								Trial active: <strong className='text-amber-100'>{trialDaysLeft <= 1 ? "Ends today" : `${trialDaysLeft} days left`}</strong>. Lock in Pro before your trial ends.
							</span>
						</div>
						<Button
							size='sm'
							variant='primary'
							className='font-semibold text-black'
							onPress={() => {
								trackPaywallEvent(plausible, "paywall_cta_click", {
									source: "paywall_banner",
									feature: "trial_active",
									plan: currentUser?.plan ?? "free",
								});
								onUpgradeOpen();
							}}
						>
							Upgrade now
						</Button>
					</div>
				)}
			</div>
		);
	}, [activeTab, overlays, playlists, runners?.length, userId, currentUser, reloadOverlays, isLoading, hasAccess, editorAccessList, plausible, onUpgradeOpen, router]);

	const bottomContent = useMemo(() => {
		return (
			<div className='mt-3 flex w-full flex-col items-center justify-between gap-2 px-2 py-2 sm:flex-row'>
				<AppPagination page={page} total={pages} onChange={setPage} showSinglePage />
				<div className='flex items-center justify-end gap-6'>
					<span className='text-sm text-muted'>{filterSelectedKeys === "all" ? "All items selected" : `${filterSelectedKeys.size} of ${filteredItems.length} selected`}</span>
					<div className='flex items-center gap-3'>
						<Button isDisabled={page === 1} size='sm' variant='tertiary' onPress={onPreviousPage} aria-label='Previous Page'>
							Previous
						</Button>
						<Button isDisabled={page === pages} size='sm' variant='tertiary' onPress={onNextPage} aria-label='Next Page'>
							Next
						</Button>
					</div>
				</div>
			</div>
		);
	}, [filterSelectedKeys, page, pages, filteredItems.length, onPreviousPage, onNextPage]);

	return (
		<div className='h-full w-full p-6'>
			{topBar}
			<Tabs selectedKey={activeTab} onSelectionChange={onTabChange} className='mb-4 w-fit max-w-full'>
				<Tabs.ListContainer className='w-fit max-w-full'>
					<Tabs.List aria-label='Resource type' className='w-fit max-w-full *:w-fit'>
						<Tabs.Tab id='overlays' className='flex-none'>
							<Label>Overlays</Label>
							<Tabs.Indicator />
						</Tabs.Tab>
						<Tabs.Tab id='playlists' className='flex-none'>
							<Label>Playlists</Label>
							<Tabs.Indicator />
						</Tabs.Tab>
						<Tabs.Tab id='runners' className='flex-none'>
							<Label>Runners</Label>
							<Tabs.Indicator />
						</Tabs.Tab>
					</Tabs.List>
				</Tabs.ListContainer>
			</Tabs>
			{activeTab === "overlays" && currentUser && (currentUser.entitlements?.effectivePlan ?? currentUser.plan) === "free" && !getFeatureAccess(currentUser, "multi_overlay").allowed && (overlays?.filter((o) => o.ownerId === userId).length ?? 0) >= 1 && (
				<div className='mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning bg-warning-soft px-4 py-3 text-sm text-warning'>
					<span>You&apos;re on the Free plan and have reached the overlay limit. Upgrade to add more overlays.</span>
					<Button variant='tertiary' onPress={onUpgradeOpen}>
						Upgrade to Pro
					</Button>
				</div>
			)}
			{activeTab === "playlists" && currentUser && (currentUser.entitlements?.effectivePlan ?? currentUser.plan) === "free" && !getFeatureAccess(currentUser, "multi_playlist").allowed && (playlists?.filter((p) => p.ownerId === userId).length ?? 0) >= 1 && (
				<div className='mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning bg-warning-soft px-4 py-3 text-sm text-warning'>
					<span>You&apos;re on the Free plan and have reached the playlist limit. Upgrade to add more playlists.</span>
					<Button variant='tertiary' onPress={onUpgradeOpen}>
						Upgrade to Pro
					</Button>
				</div>
			)}
			{activeTab === "runners" && currentUser && !currentUser.entitlements?.runnerAccess && (
				<div className='mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning bg-warning-soft px-4 py-3 text-sm text-warning'>
					<div>
						<p className='font-medium'>Self-hosted runners are an optional add-on.</p>
						<p className='text-xs text-warning/80'>Purchase the Runner add-on to create, connect, and stream with runners. Your Free or Pro limits still apply.</p>
					</div>
					<Button variant='tertiary' onPress={onUpgradeOpen}>
						{currentUser.entitlements?.effectivePlan === "pro" ? "Add Runner add-on" : "Upgrade with Runner"}
					</Button>
				</div>
			)}
			{topContent}
			<Table>
				<Table.ScrollContainer>
					<Table.Content
						aria-label='Management table'
						selectedKeys={filterSelectedKeys}
						selectionMode='multiple'
						sortDescriptor={sortDescriptor}
						onSelectionChange={onSelectionChange}
						onSortChange={setSortDescriptor}
						onRowAction={(key) => {
							if (activeTab === "runners") {
								router.push(`/dashboard/runners/${String(key)}`);
							} else {
								router.push(`/dashboard/${activeTab === "overlays" ? "overlay" : "playlist"}/${String(key)}`);
							}
						}}
					>
						<Table.Header>
							<Table.Column className='pr-0'>
								<Checkbox aria-label='Select all items' slot='selection'>
									<Checkbox.Content>
										<Checkbox.Control>
											<Checkbox.Indicator />
										</Checkbox.Control>
									</Checkbox.Content>
								</Checkbox>
							</Table.Column>
							{headerColumns.map((column) => (
								<Table.Column
									key={column.uid}
									id={column.uid}
									allowsSorting={column.uid === "name" || column.uid === "clipCount"}
									isRowHeader={column.uid === rowHeaderColumn}
									className={cn([column.uid === "actions" ? "flex items-center justify-end px-[20px]" : "", column.uid === "accessType" ? "w-[48px] min-w-[48px] max-w-[48px] px-1" : "", column.uid === "id" ? "min-w-[260px]" : "", column.uid === "clipCount" ? "w-[90px] min-w-[90px] max-w-[90px] text-right" : "", column.uid === "name" ? "min-w-[160px]" : ""])}
								>
									{column.uid === "name" || column.uid === "clipCount" ? (
										({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>{column.name}</Table.SortableColumnHeader>
									) : column.info ? (
										<div className='flex min-w-[108px] items-center justify-between'>
											{column.name}
											<Tooltip delay={0}>
												<Tooltip.Trigger>
													<IconInfoCircle className='text-muted' height={16} width={16} />
												</Tooltip.Trigger>
												<Tooltip.Content>{column.info}</Tooltip.Content>
											</Tooltip>
										</div>
									) : (
										column.name
									)}
								</Table.Column>
							))}
						</Table.Header>
						<Table.Body
							renderEmptyState={() => {
								if (activeTab === "overlays") {
									return overlays === undefined ? (
										<span className='flex w-full items-center justify-center gap-2 p-4'>
											<Spinner />
											Loading overlays
										</span>
									) : (
										<div className='w-full p-4 text-center text-muted'>No overlays found</div>
									);
								} else if (activeTab === "playlists") {
									return playlists === undefined ? (
										<span className='flex w-full items-center justify-center gap-2 p-4'>
											<Spinner />
											Loading playlists
										</span>
									) : (
										<div className='w-full p-4 text-center text-muted'>No playlists found</div>
									);
								} else {
									return runners === undefined ? (
										<span className='flex w-full items-center justify-center gap-2 p-4'>
											<Spinner />
											Loading runners
										</span>
									) : (
										<div className='flex w-full flex-col items-center gap-2 p-6 text-center'>
											{currentUser?.entitlements?.runnerAccess ? (
												<>
													<p className='text-muted'>No runners found</p>
													<Button size='sm' variant='secondary' onPress={() => router.push("/runner/enroll")}>
														Create runner
													</Button>
												</>
											) : (
												<>
													<p className='font-medium text-foreground'>Runner add-on required</p>
													<p className='max-w-md text-sm text-muted'>Purchase the self-hosted Runner add-on to create and connect runners.</p>
													<Button size='sm' variant='primary' onPress={onUpgradeOpen}>
														{currentUser?.entitlements?.effectivePlan === "pro" ? "Add Runner add-on" : "Upgrade with Runner"}
													</Button>
												</>
											)}
										</div>
									);
								}
							}}
						>
							{sortedItems.map((item) => (
								<Table.Row key={item.id} id={item.id} textValue={item.name}>
									<Table.Cell className='pr-0'>
										<Checkbox aria-label={`Select ${item.name}`} slot='selection' variant='secondary'>
											<Checkbox.Content>
												<Checkbox.Control>
													<Checkbox.Indicator />
												</Checkbox.Control>
											</Checkbox.Content>
										</Checkbox>
									</Table.Cell>
									{headerColumns.map((column) => (
										<Table.Cell key={column.uid} className={cn(column.uid === "accessType" ? "w-[48px] min-w-[48px] max-w-[48px] px-1" : "", column.uid === "id" ? "min-w-[260px]" : "", column.uid === "clipCount" ? "w-[90px] min-w-[90px] max-w-[90px] text-right" : "", column.uid === "name" ? "min-w-[160px]" : "")}>
											{renderCell(item, column.uid)}
										</Table.Cell>
									))}
								</Table.Row>
							))}
						</Table.Body>
					</Table.Content>
				</Table.ScrollContainer>
			</Table>
			{bottomContent}

			<ConfirmModal
				isOpen={deleteRequest !== null}
				onOpenChange={(isOpen) => {
					if (!isOpen) setDeleteRequest(null);
				}}
				title={deleteRequest?.kind === "runner" ? "Delete runner" : deleteRequest?.kind === "playlist" ? "Delete playlist" : "Delete overlay"}
				description={deleteRequest?.kind === "runner" ? `Delete "${deleteRequest.name}" permanently? This will remove the runner and revoke access.` : deleteRequest?.kind === "playlist" ? `Delete playlist "${deleteRequest.name}" permanently? This cannot be undone.` : `Delete overlay "${deleteRequest?.name ?? ""}" permanently? This cannot be undone.`}
				confirmLabel='Delete'
				cancelLabel='Cancel'
				onConfirm={confirmDelete}
			/>

			<ConfirmModal
				isOpen={unlinkRequest !== null}
				onOpenChange={(isOpen) => {
					if (!isOpen) setUnlinkRequest(null);
				}}
				title='Unlink runners'
				description={unlinkRequest?.ids.length === 1 ? `Unlink "${unlinkRequest.name}" from this account?` : `Unlink ${unlinkRequest?.ids.length ?? 0} connected runners from this account?`}
				confirmLabel='Unlink'
				cancelLabel='Cancel'
				keyword='UNLINK'
				onConfirm={confirmUnlink}
			/>

			{currentUser && (
				<UpgradeModal
					isOpen={isUpgradeOpen}
					onOpenChange={onUpgradeOpenChange}
					user={currentUser}
					title={activeTab === "overlays" ? "Upgrade to add more overlays" : activeTab === "playlists" ? "Upgrade to add more playlists" : currentUser.entitlements?.effectivePlan === "pro" ? "Add the Runner add-on" : "Upgrade with Runner"}
					description={activeTab === "runners" ? "Run Clipify overlays from your own computer with the self-hosted Runner add-on." : undefined}
					source='upgrade_modal'
					feature={activeTab === "overlays" ? "multi_overlay" : activeTab === "playlists" ? "multi_playlist" : "runner_access"}
					mode={activeTab === "runners" ? "runner_addon" : "plan"}
				/>
			)}
		</div>
	);
}

function AvatarCell({ ownerId, userId }: { ownerId: string; userId: string }) {
	const [src, setSrc] = React.useState<string | null>(null);
	const [loading, setLoading] = React.useState(true);

	React.useEffect(() => {
		let cancelled = false;

		(async () => {
			try {
				const url = await getAvatar(ownerId, userId);
				if (!cancelled) setSrc(url ?? null);
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [ownerId, userId]);

	return loading ? (
		<Skeleton className='h-8 w-8 rounded-full' />
	) : (
		<Avatar size='sm'>
			<Avatar.Image alt='' src={src ?? undefined} />
			<Avatar.Fallback>?</Avatar.Fallback>
		</Avatar>
	);
}
