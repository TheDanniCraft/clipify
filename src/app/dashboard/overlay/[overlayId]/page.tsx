"use client";

import { useEffect, useState } from "react";

import { useParams, useRouter } from "next/navigation";
import { getOverlay, getOverlayOwnerPlan, saveOverlay } from "@actions/database";
import { addToast, Button, Card, CardBody, CardHeader, Divider, Form, Image, Input, Link, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, NumberInput, Select, SelectItem, Slider, Snippet, Spinner, Switch, Tooltip, useDisclosure } from "@heroui/react";
import { AuthenticatedUser, Overlay, OverlayType, Plan, StatusOptions, TwitchClip, TwitchReward } from "@types";
import { IconAlertTriangle, IconArrowLeft, IconCrown, IconDeviceFloppy, IconInfoCircle, IconPlayerPauseFilled, IconPlayerPlayFilled } from "@tabler/icons-react";
import DashboardNavbar from "@components/dashboardNavbar";
import { useNavigationGuard } from "next-navigation-guard";
import { validateAuth } from "@actions/auth";
import { createChannelReward, getReward, getTwitchClips, removeChannelReward } from "@actions/twitch";
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
	{ key: "1" as OverlayType, label: "Top Clips - Today" },
	{ key: "7" as OverlayType, label: "Top Clips - Last 7 Days" },
	{ key: "30" as OverlayType, label: "Top Clips - Last 30 Days" },
	{ key: "90" as OverlayType, label: "Top Clips - Last 90 Days" },
	{ key: "180" as OverlayType, label: "Top Clips - Last 180 Days" },
	{ key: "365" as OverlayType, label: "Top Clips - Last Year" },
	{ key: "Featured" as OverlayType, label: "Featured only" },
	{ key: "All" as OverlayType, label: "All Clips" },
	{ key: "Queue" as OverlayType, label: "Clip Queue" },
];

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
	const { isOpen: isCliplistOpen, onOpen: onCliplistOpen, onOpenChange: onCliplistOpenChange } = useDisclosure();
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
						} catch (saveError) {
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
		async function getClipsForType() {
			if (!overlay) return;
			const clips = await getTwitchClips(overlay, overlay.type, true);
			setPreviewClips(clips);
		}
		getClipsForType();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [overlay?.type]);

	const ownerHasAdvancedAccess = ownerPlan === Plan.Pro;
	const inTrial = user ? isReverseTrialActive(user) : false;
	const trialDaysLeft = user ? getTrialDaysLeft(user) : 0;

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
			rewardId: overlay.rewardId,
			minClipDuration: overlay.minClipDuration,
			maxClipDuration: overlay.maxClipDuration,
			blacklistWords: overlay.blacklistWords,
			minClipViews: overlay.minClipViews,
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
												setOverlay({ ...overlay, type: value.currentKey as OverlayType });
											}}
											label='Overlay Type'
										>
											{overlayTypes.map((type) => (
												<SelectItem key={type.key}>{type.key !== "Queue" ? type.label : type.label}</SelectItem>
											))}
										</Select>
										<Button isIconOnly onPress={onCliplistOpen} size='lg' className='ml-2'>
											<span>
												{
													previewClips.filter((clip) => {
														return clip.duration >= overlay.minClipDuration && clip.duration <= overlay.maxClipDuration && !isTitleBlocked(clip.title, overlay.blacklistWords) && clip.view_count >= overlay.minClipViews;
													}).length
												}
											</span>
										</Button>
									</div>

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
											filter: ownerPlan === Plan.Free && !ownerHasAdvancedAccess ? "blur(1.5px)" : "none",
											pointerEvents: ownerPlan === Plan.Free && !ownerHasAdvancedAccess ? "none" : "auto",
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
													// Dont allow manual input, but let them clear it (isReadOnly would disable clearing)
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
										<TagsInput className='p-2' fullWidth label='Blacklisted Words' value={overlay.blacklistWords} onValueChange={(value) => setOverlay({ ...overlay, blacklistWords: value })} description='Hide clips containing certain words in their titles. Supports RE2 regex (no lookarounds). Example: ^hello$' />
									</div>
								</Form>
							</div>
						</CardBody>
					</Card>
				</div>

				<Modal isOpen={isCliplistOpen} onOpenChange={onCliplistOpenChange}>
					<ModalContent className='flex max-h-[80vh] flex-col overflow-hidden'>
						<ModalHeader>Preview Clips</ModalHeader>
						<ModalBody className='flex-1 overflow-y-auto'>
							<ul className='space-y-2'>
								{previewClips
									.filter((clip) => {
										return clip.duration >= overlay.minClipDuration && clip.duration <= overlay.maxClipDuration && !isTitleBlocked(clip.title, overlay.blacklistWords) && clip.view_count >= overlay.minClipViews;
									})
									.map((clip) => (
										<li key={clip.id} className='flex gap-3 items-center rounded-md p-2 hover:bg-white/5 transition'>
											<a href={clip.url} target='_blank' rel='noopener noreferrer' className='flex items-center gap-3 w-full'>
												{/* Thumbnail */}
												<Image src={clip.thumbnail_url} alt={clip.title} className='h-12 w-20 rounded object-cover flex-shrink-0' />

												{/* Text */}
												<div className='min-w-0'>
													<p className='text-sm font-medium truncate'>{clip.title}</p>
													<p className='text-xs text-white/60'>clipped by {clip.creator_name}</p>
													<div className='text-xs text-white/60'>
														<span>{clip.view_count} views</span>
														<span className='mx-1'>•</span>
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
