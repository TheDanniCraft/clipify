"use client";

import { useEffect, useState } from "react";

import { useParams, useRouter } from "next/navigation";
import { createPlaylist, getClipCacheStatus, getOverlay, getOverlayOwnerPlan, getPlaylistsForOwner, importPlaylistClips, reorderPlaylistClips, saveOverlay, upsertPlaylistClips } from "@actions/database";
import { addToast, Button, Card, CardBody, CardHeader, Divider, Form, Image, Input, Link, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, NumberInput, Select, SelectItem, Slider, Snippet, Spinner, Switch, Tooltip, useDisclosure } from "@heroui/react";
import { AuthenticatedUser, Overlay, OverlayType, Plan, PlaybackMode, StatusOptions, TwitchClip, TwitchReward } from "@types";
import { IconAlertTriangle, IconArrowLeft, IconCrown, IconDeviceFloppy, IconGripVertical, IconInfoCircle, IconPaint, IconPlayerPauseFilled, IconPlayerPlayFilled, IconPlus } from "@tabler/icons-react";
import DashboardNavbar from "@components/dashboardNavbar";
import { useNavigationGuard } from "next-navigation-guard";
import { validateAuth } from "@actions/auth";
import { createChannelReward, getReward, getTwitchClips, handleClip, removeChannelReward } from "@actions/twitch";
import { REWARD_NOT_FOUND } from "@lib/twitchErrors";
import FeedbackWidget from "@components/feedbackWidget";
import TagsInput from "@components/tagsInput";
import { isTitleBlocked } from "@/app/utils/regexFilter";
import UpgradeModal from "@components/upgradeModal";
import ChatwootData from "@components/chatwootData";
import { getTrialDaysLeft, isReverseTrialActive } from "@lib/featureAccess";
import { usePlausible } from "next-plausible";
import { trackPaywallEvent } from "@lib/paywallTracking";

const overlayTypes: { key: OverlayType; label: string }[] = [
	{ key: OverlayType.Today, label: "Top Clips - Today" },
	{ key: OverlayType.LastWeek, label: "Top Clips - Last 7 Days" },
	{ key: OverlayType.LastMonth, label: "Top Clips - Last 30 Days" },
	{ key: OverlayType.LastQuarter, label: "Top Clips - Last 90 Days" },
	{ key: OverlayType.Last180Days, label: "Top Clips - Last 180 Days" },
	{ key: OverlayType.LastYear, label: "Top Clips - Last Year" },
	{ key: OverlayType.Featured, label: "Featured only" },
	{ key: OverlayType.All, label: "All Clips" },
	{ key: OverlayType.Playlist, label: "Playlist Snapshot" },
	{ key: OverlayType.Queue, label: "Clip Queue" },
];

const playbackModes: { key: PlaybackMode; label: string }[] = [
	{ key: PlaybackMode.Random, label: "Random" },
	{ key: PlaybackMode.Top, label: "Top (Most Viewed First)" },
	{ key: PlaybackMode.SmartShuffle, label: "Smart Shuffle" },
];

const playbackModeHelpText: Record<PlaybackMode, string> = {
	[PlaybackMode.Random]: "Plays a randomized clip order from the filtered pool.",
	[PlaybackMode.Top]: "Plays highest-viewed clips first. Great for strongest highlights.",
	[PlaybackMode.SmartShuffle]: "Smart Shuffle ranks clips by quality (views), then picks with weighted randomness. It temporarily downranks clip authors/categories that appeared recently, occasionally promotes lower-view clips for variety, and avoids repeating the same pattern over and over.",
};

export default function OverlaySettings() {
	const router = useRouter();
	const { overlayId } = useParams() as { overlayId: string };

	const [overlay, setOverlay] = useState<Overlay | null>(null);
	const [baseOverlay, setBaseOverlay] = useState<Overlay | null>(null);
	const [baseUrl] = useState<string | null>(typeof window !== "undefined" ? window.location.origin : null);
	const [user, setUser] = useState<AuthenticatedUser>();
	const [reward, setReward] = useState<TwitchReward | null>(null);
	const [ownerPlan, setOwnerPlan] = useState<Plan | null>(null);
	const [previewClips, setPreviewClips] = useState<TwitchClip[]>([]);
	const [previewReviewMode, setPreviewReviewMode] = useState(true);
	const [playlists, setPlaylists] = useState<Array<{ id: string; name: string; clipCount: number }>>([]);
	const [playlistClips, setPlaylistClips] = useState<TwitchClip[]>([]);
	const [newPlaylistName, setNewPlaylistName] = useState("");
	const [newClipInput, setNewClipInput] = useState("");
	const [importStartDate, setImportStartDate] = useState("");
	const [importEndDate, setImportEndDate] = useState("");
	const [importCategoryId, setImportCategoryId] = useState("");
	const [importMinViews, setImportMinViews] = useState(0);
	const [importIncludeModQueue, setImportIncludeModQueue] = useState(false);
	const [importCreatorAllowlist, setImportCreatorAllowlist] = useState<string[]>([]);
	const [importCreatorDenylist, setImportCreatorDenylist] = useState<string[]>([]);
	const [pendingImportMode, setPendingImportMode] = useState<"append" | "replace" | null>(null);
	const [draggedClipId, setDraggedClipId] = useState<string | null>(null);
	const [clipCacheStatus, setClipCacheStatus] = useState<Awaited<ReturnType<typeof getClipCacheStatus>> | null>(null);
	const { isOpen: isCliplistOpen, onOpen: onCliplistOpen, onOpenChange: onCliplistOpenChange } = useDisclosure();
	const { isOpen: isPlaylistOpen, onOpen: onPlaylistOpen, onOpenChange: onPlaylistOpenChange } = useDisclosure();
	const { isOpen: isImportOpen, onOpen: onImportOpen, onOpenChange: onImportOpenChange } = useDisclosure();
	const { isOpen: isUpgradeOpen, onOpen: onUpgradeOpen, onOpenChange: onUpgradeOpenChange } = useDisclosure();
	const plausible = usePlausible();

	const navGuard = useNavigationGuard({ enabled: isFormDirty() });

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
	}, [addToast, overlay?.id, overlay?.ownerId, overlay?.rewardId]);

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
		}
		getClipsForType();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [overlay?.type, overlay?.playlistId]);

	useEffect(() => {
		async function getPlaylistSnapshot() {
			if (!overlay?.playlistId) {
				setPlaylistClips([]);
				return;
			}
			const playlist = playlists.find((entry) => entry.id === overlay.playlistId);
			if (!playlist) return;
			const clips = await getTwitchClips({ ...overlay, type: OverlayType.Playlist }, OverlayType.Playlist, true);
			setPlaylistClips(clips);
		}
		getPlaylistSnapshot();
		// eslint-disable-next-line react-hooks/exhaustive-deps
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
	const inTrial = user ? isReverseTrialActive(user) : false;
	const trialDaysLeft = user ? getTrialDaysLeft(user) : 0;

	async function refreshPlaylists() {
		const rows = await getPlaylistsForOwner(currentOverlay.ownerId);
		setPlaylists((rows ?? []).map((row) => ({ id: row.id, name: row.name, clipCount: row.clipCount })));
	}

	async function handleCreatePlaylist() {
		const name = newPlaylistName.trim();
		if (!name) return;
		try {
			const playlist = await createPlaylist(currentOverlay.ownerId, name);
			if (!playlist) return;
			await refreshPlaylists();
			setOverlay((prev) => (prev ? { ...prev, playlistId: playlist.id, type: OverlayType.Playlist } : prev));
			setNewPlaylistName("");
			addToast({ title: "Playlist created", color: "success" });
		} catch (error) {
			addToast({
				title: "Failed to create playlist",
				description: error instanceof Error ? error.message : "Please try again.",
				color: "danger",
			});
		}
	}

	async function handleAddClipToPlaylist() {
		if (!currentOverlay.playlistId) return;
		const input = newClipInput.trim();
		if (!input) return;
		const clip = await handleClip(input, currentOverlay.ownerId);
		if (!clip || "errorCode" in clip) {
			addToast({
				title: "Could not add clip",
				description: "Invalid clip URL/ID or the clip does not belong to this channel.",
				color: "danger",
			});
			return;
		}
		try {
			const next = await upsertPlaylistClips(currentOverlay.playlistId, [clip], "append");
			setPlaylistClips(next);
			setNewClipInput("");
			await refreshPlaylists();
		} catch (error) {
			addToast({
				title: "Failed to add clip",
				description: error instanceof Error ? error.message : "Please try again.",
				color: "danger",
			});
		}
	}

	async function runImport(mode: "append" | "replace") {
		if (!currentOverlay.playlistId) return;
		try {
			const clips = await importPlaylistClips(
				currentOverlay.playlistId,
				{
					overlayType: OverlayType.All,
					startDate: importStartDate || null,
					endDate: importEndDate || null,
					categoryId: importCategoryId || null,
					minViews: importMinViews,
					clipCreatorsOnly: importCreatorAllowlist,
					clipCreatorsBlocked: importCreatorDenylist,
					includeModQueue: importIncludeModQueue,
				},
				mode,
			);
			setPlaylistClips(clips);
			await refreshPlaylists();
			addToast({ title: `Imported ${clips.length} clips`, color: "success" });
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
									<div className='w-full flex justify-center items-center text-xs text-warning-300 p-2 border border-warning-200 rounded bg-warning-50 max-w-full mb-2'>
										<IconAlertTriangle size={16} className='mr-2' />
										<span className='text-center'>
											Do not share this URL publicly. For embedding on websites, use the{" "}
											<Link color='warning' underline='always' className='text-xs' href={`${baseUrl}/dashboard/embed?oid=${overlayId}`}>
												embed widget tool
											</Link>
											.
										</span>
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
													playlistId: nextType === OverlayType.Playlist ? overlay.playlistId ?? fallbackPlaylistId : null,
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
												{playbackModes.map((mode) => (
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
														onSelectionChange={(value) => setOverlay({ ...overlay, playlistId: (value.currentKey as string | null) ?? null })}
														label='Playlist'
														className='flex-1'
													>
														{playlists.map((playlist) => (
															<SelectItem key={playlist.id}>{`${playlist.name} (${playlist.clipCount})`}</SelectItem>
														))}
													</Select>
													<Button onPress={onPlaylistOpen}>Manage</Button>
												</div>
												<div className='flex w-full items-end gap-2'>
													<Input value={newPlaylistName} onValueChange={setNewPlaylistName} label='New Playlist Name' placeholder='My best clips' className='flex-1' />
													<Button color='primary' startContent={<IconPlus size={14} />} onPress={handleCreatePlaylist}>
														Create
													</Button>
												</div>
												<div className='text-xs text-default-500'>Playlists are snapshots of clips. Free: 1 playlist with up to 50 clips. Pro: unlimited playlists and clips.</div>
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
												<TagsInput className='p-2' fullWidth label='Only These Clip Creators' value={overlay.clipCreatorsOnly} onValueChange={(value) => setOverlay({ ...overlay, clipCreatorsOnly: value })} description='Allow only specific clip creators (Twitch usernames).' />
												<TagsInput className='p-2' fullWidth label='Blocked Clip Creators' value={overlay.clipCreatorsBlocked} onValueChange={(value) => setOverlay({ ...overlay, clipCreatorsBlocked: value })} description='Exclude specific clip creators from playback.' />
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
							<Button size='sm' variant='flat' onPress={onImportOpen} isDisabled={!selectedPlaylist}>
								Auto import
							</Button>
						</ModalHeader>
						<ModalBody className='overflow-y-auto'>
							<div className='flex gap-2'>
								<Input value={newClipInput} onValueChange={setNewClipInput} label='Add Clip URL' placeholder='https://clips.twitch.tv/...' className='flex-1' />
								<Button color='primary' onPress={handleAddClipToPlaylist} isDisabled={!overlay.playlistId}>
									Add
								</Button>
							</div>
							<div className='text-xs text-default-500'>Drag and drop to reorder. Save order to persist changes.</div>
							<ul className='space-y-2'>
								{playlistClips.map((clip) => (
									<li
										key={clip.id}
										draggable
										onDragStart={() => setDraggedClipId(clip.id)}
										onDragOver={(event) => event.preventDefault()}
										onDrop={() => {
											if (!draggedClipId || draggedClipId === clip.id) return;
											const fromIndex = playlistClips.findIndex((entry) => entry.id === draggedClipId);
											const toIndex = playlistClips.findIndex((entry) => entry.id === clip.id);
											if (fromIndex < 0 || toIndex < 0) return;
											const next = [...playlistClips];
											const [moved] = next.splice(fromIndex, 1);
											next.splice(toIndex, 0, moved);
											setPlaylistClips(next);
										}}
										className='flex items-center gap-3 rounded border border-default-200 px-3 py-2'
									>
										<IconGripVertical size={16} className='text-default-400' />
										<Image src={clip.thumbnail_url} alt={clip.title} className='h-10 w-16 rounded object-cover' />
										<div className='min-w-0 flex-1'>
											<div className='truncate text-sm font-medium'>{clip.title}</div>
											<div className='text-xs text-default-500'>{clip.creator_name}</div>
										</div>
										<div className='text-xs text-default-500'>{clip.view_count} views</div>
									</li>
								))}
							</ul>
						</ModalBody>
						<ModalFooter>
							<Button variant='light' onPress={onPlaylistOpenChange}>
								Close
							</Button>
							<Button
								color='primary'
								onPress={async () => {
									if (!overlay.playlistId) return;
									const reordered = await reorderPlaylistClips(
										overlay.playlistId,
										playlistClips.map((clip) => clip.id),
									);
									setPlaylistClips(reordered);
									addToast({ title: "Playlist order saved", color: "success" });
								}}
								isDisabled={!overlay.playlistId || playlistClips.length === 0}
							>
								Save order
							</Button>
						</ModalFooter>
					</ModalContent>
				</Modal>

				<Modal isOpen={isImportOpen} onOpenChange={onImportOpenChange}>
					<ModalContent>
						<ModalHeader>Auto Import to Playlist</ModalHeader>
						<ModalBody className='space-y-2'>
							{!canUseAutoImport && <div className='rounded border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-700'>Auto import is available on Pro.</div>}
							<Input label='Category (Game ID)' value={importCategoryId} onValueChange={setImportCategoryId} />
							<div className='grid grid-cols-2 gap-2'>
								<Input type='date' label='Start Date' value={importStartDate} onValueChange={setImportStartDate} />
								<Input type='date' label='End Date' value={importEndDate} onValueChange={setImportEndDate} />
							</div>
							<NumberInput label='Minimum Views' minValue={0} value={importMinViews} onValueChange={(value) => setImportMinViews(Number(value) || 0)} />
							<Switch isSelected={importIncludeModQueue} onValueChange={setImportIncludeModQueue}>
								Include mod queue clips
							</Switch>
							<TagsInput fullWidth label='Creator Allowlist' value={importCreatorAllowlist} onValueChange={setImportCreatorAllowlist} />
							<TagsInput fullWidth label='Creator Denylist' value={importCreatorDenylist} onValueChange={setImportCreatorDenylist} />
						</ModalBody>
						<ModalFooter>
							<Button variant='light' onPress={onImportOpenChange}>
								Cancel
							</Button>
							<Button
								color='primary'
								isDisabled={!canUseAutoImport || !overlay.playlistId}
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
