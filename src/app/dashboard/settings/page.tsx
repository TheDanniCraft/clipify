"use client";

import { validateAuth } from "@actions/auth";
import { deleteUser, getClipCacheStatus, getSettings, saveSettings } from "@actions/database";
import ConfirmModal from "@components/confirmModal";
import DashboardNavbar from "@components/dashboardNavbar";
import { AuthenticatedUser, Plan, UserSettings } from "@types";
import { addToast, Avatar, Button, Card, CardBody, CardHeader, Divider, Form, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Snippet, Spinner, Switch, Tooltip, useDisclosure } from "@heroui/react";
import { IconAlertTriangle, IconArrowLeft, IconCreditCardFilled, IconCrown, IconDatabase, IconDeviceFloppy, IconDiamondFilled, IconInfoCircle, IconRefresh, IconTrash } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { generatePaymentLink, checkIfSubscriptionExists, getPortalLink } from "@actions/subscription";
import { forceRefreshOwnClipCache, getOwnClipForceRefreshStatus } from "@actions/twitch";
import { useNavigationGuard } from "next-navigation-guard";
import UpgradeModal from "@components/upgradeModal";
import TagsInput from "@components/tagsInput";
import ChatwootData from "@components/chatwootData";
import { getFeatureAccess, getTrialDaysLeft, isReverseTrialActive } from "@lib/featureAccess";
import { usePlausible } from "next-plausible";
import { trackPaywallEvent } from "@lib/paywallTracking";
import type { BillingCycle, PaywallSource } from "@actions/subscription";

type ClipCacheStatusState = {
	cachedClipCount: number;
	unavailableClipCount: number;
	oldestClipDate: string | null;
	lastIncrementalSyncAt: string | null;
	lastBackfillSyncAt: string | null;
	backfillComplete: boolean;
	estimatedCoveragePercent: number;
};

type ClipForceRefreshStatusState = {
	lastForcedAt: string | null;
	cooldownMs: number;
	nextAllowedAt: string;
	remainingMs: number;
	canRefresh: boolean;
} | null;

export default function SettingsPage() {
	const [user, setUser] = useState<AuthenticatedUser | null>(null);
	const { isOpen: upgradeModalIsOpen, onOpen: upgradeModalOnOpen, onOpenChange: upgradeModalOnOpenChange } = useDisclosure();
	const { isOpen: deleteModalIsOpen, onOpen: deleteModalOnOpen, onOpenChange: deleteModalOnOpenChange } = useDisclosure();
	const [timer, setTimer] = useState<number>(0);
	const [settings, setSettings] = useState<UserSettings | null>(null);
	const [baseSettings, setBaseSettings] = useState<UserSettings | null>(null);
	const [clipCacheStatus, setClipCacheStatus] = useState<ClipCacheStatusState | null>(null);
	const [clipForceRefreshStatus, setClipForceRefreshStatus] = useState<ClipForceRefreshStatusState>(null);
	const [isForceRefreshing, setIsForceRefreshing] = useState(false);
	const [isRefreshingStats, setIsRefreshingStats] = useState(false);
	const plausible = usePlausible();

	const router = useRouter();
	const navGuard = useNavigationGuard({ enabled: isFormDirty() });

	useEffect(() => {
		async function validateUser() {
			const user = await validateAuth();
			if (!user) {
				router.push("/logout");
				return;
			}

			setUser(user);
		}

		validateUser();
	}, [router]);

	useEffect(() => {
		if (timer > 0) {
			const interval = setInterval(() => {
				setTimer((prev) => prev - 1);
			}, 1000);
			return () => clearInterval(interval);
		}
	}, [timer]);

	const hasForceRefreshStatus = !!clipForceRefreshStatus;
	const canRefresh = clipForceRefreshStatus?.canRefresh;

	useEffect(() => {
		if (!hasForceRefreshStatus || canRefresh) return;
		const interval = setInterval(() => {
			setClipForceRefreshStatus((prev) => {
				if (!prev) return prev;
				const next = Math.max(0, prev.remainingMs - 1000);
				return {
					...prev,
					remainingMs: next,
					canRefresh: next <= 0,
				};
			});
		}, 1000);
		return () => clearInterval(interval);
	}, [canRefresh, hasForceRefreshStatus]);

	useEffect(() => {
		async function fetchSettings() {
			if (!user) return;
			const fetchedSettings = await getSettings(user.id, true);
			setSettings(fetchedSettings);
			setBaseSettings(fetchedSettings);
			const status = await getClipCacheStatus(user.id);
			setClipCacheStatus(status);
			const forceStatus = await getOwnClipForceRefreshStatus();
			setClipForceRefreshStatus(forceStatus);
		}

		fetchSettings();
	}, [user]);

	const upgradeIntent = useMemo<{ cycle: BillingCycle; source: PaywallSource; feature: string }>(() => {
		if (typeof window === "undefined") {
			return { cycle: "yearly", source: "upgrade_modal", feature: "account" };
		}
		const params = new URLSearchParams(window.location.search);
		const cycle = params.get("cycle");
		const source = params.get("source");
		const feature = params.get("feature");
		return {
			cycle: cycle === "monthly" || cycle === "yearly" ? cycle : ("yearly" as const),
			source: source === "pricing_page" || source === "upgrade_modal" || source === "paywall_banner" ? source : ("upgrade_modal" as const),
			feature: feature || "account",
		};
	}, []);
	const effectivePlan = user?.entitlements?.effectivePlan ?? user?.plan ?? Plan.Free;
	const isEffectivelyFree = effectivePlan === Plan.Free;
	const canUpgradeFromBilling = user?.plan === Plan.Free;
	const receivesProductUpdates = Boolean(settings?.marketingOptIn);

	useEffect(() => {
		if (!user || typeof window === "undefined") return;
		const params = new URLSearchParams(window.location.search);
		if (!params.has("upgrade") || !canUpgradeFromBilling) return;
		upgradeModalOnOpen();
	}, [canUpgradeFromBilling, upgradeModalOnOpen, user]);

	const editorsAccess = user ? getFeatureAccess(user, "editors") : { allowed: false as const };
	const inTrial = user ? isReverseTrialActive(user) : false;
	const trialDaysLeft = user ? getTrialDaysLeft(user) : 0;
	const trialSummaryLabel = trialDaysLeft <= 1 ? "Ends today" : `${trialDaysLeft} days left`;
	const effectivePlanLabel = inTrial ? `Pro (trial ${trialSummaryLabel})` : effectivePlan === Plan.Pro ? "Pro" : "Free";

	useEffect(() => {
		if (!user) return;
		if (!isEffectivelyFree || editorsAccess.allowed) return;
		trackPaywallEvent(plausible, "paywall_impression", {
			source: "paywall_banner",
			feature: "editors",
			plan: user.plan,
		});
	}, [editorsAccess.allowed, isEffectivelyFree, plausible, user]);

	if (!user) {
		return (
			<div className='flex items-center justify-center h-screen w-full'>
				<Spinner label='Loading' />
			</div>
		);
	}

	function isFormDirty() {
		return JSON.stringify(settings) !== JSON.stringify(baseSettings);
	}

	function formatStatusDate(value: string | null | undefined) {
		if (!value) return "Never";
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return "Unknown";
		return parsed.toLocaleString();
	}

	function formatDurationMs(value: number) {
		if (value <= 0) return "now";
		const totalSeconds = Math.ceil(value / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;
		if (hours > 0) return `${hours}h ${minutes}m`;
		if (minutes > 0) return `${minutes}m ${seconds}s`;
		return `${seconds}s`;
	}

	async function handleForceRefreshCache() {
		if (!user) return;
		try {
			setIsForceRefreshing(true);
			const result = await forceRefreshOwnClipCache();
			if (!result.ok) {
				addToast({
					title: "Refresh cooldown active",
					description: `Try again in ${formatDurationMs(result.remainingMs)}.`,
					color: "warning",
				});
				const forceStatus = await getOwnClipForceRefreshStatus();
				setClipForceRefreshStatus(forceStatus);
				return;
			}

			addToast({
				title: "Cache refresh started",
				description: "Triggered clip cache refresh successfully.",
				color: "success",
			});

			const [status, forceStatus] = await Promise.all([getClipCacheStatus(user.id), getOwnClipForceRefreshStatus()]);
			setClipCacheStatus(status);
			setClipForceRefreshStatus(forceStatus);
		} catch {
			addToast({
				title: "Error",
				description: "Failed to force refresh clip cache.",
				color: "danger",
			});
		} finally {
			setIsForceRefreshing(false);
		}
	}

	async function handleRefreshStats() {
		if (!user) return;
		try {
			setIsRefreshingStats(true);
			const [status, forceStatus] = await Promise.all([getClipCacheStatus(user.id), getOwnClipForceRefreshStatus()]);
			setClipCacheStatus(status);
			setClipForceRefreshStatus(forceStatus);
		} catch {
			addToast({
				title: "Error",
				description: "Failed to refresh clip cache statistics.",
				color: "danger",
			});
		} finally {
			setIsRefreshingStats(false);
		}
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		try {
			event.preventDefault();
			addToast({
				title: "Saving...",
				color: "default",
			});

			if (!settings) return;
			await saveSettings(settings);
			setBaseSettings(settings);
			addToast({
				title: "Settings saved",
				description: "Your settings have been saved successfully.",
				color: "success",
			});
		} catch {
			addToast({
				title: "Error",
				description: "An error occurred while saving your settings. Please try again.",
				color: "danger",
			});
		}
	}

	return (
		<>
			<ChatwootData user={user} />

			<DashboardNavbar user={user} title='Settings' tagline='Manage your settings'>
				<Card className='mt-4'>
					<CardHeader>
						<div className='flex items-center gap-2 w-full justify-between'>
							<Button isIconOnly variant='light' startContent={<IconArrowLeft />} onPress={() => router.push("/dashboard")} aria-label='Back to Dashboard' />
							<div className='flex items-center gap-2'>
								<div className='flex items-center overflow-hidden'>
									<Snippet
										size='sm'
										symbol='User ID:'
										classNames={{
											pre: "overflow-hidden whitespace-nowrap",
										}}
									>
										{user.id}
									</Snippet>
								</div>
								<Tooltip content='If you contact support, please specify this user ID.'>
									<IconInfoCircle size={20} className='text-default-400' />
								</Tooltip>
							</div>
						</div>
					</CardHeader>
					<CardBody className='pl-4 pr-4 pt-0'>
						<div className='flex items-center mb-4'>
							<Avatar src={user.avatar} size='lg' className='mr-4' />
							<div>
								<p className='text-2xl font-bold'>{user.username}</p>
								<p className='text-sm font-bold text-muted-foreground'>
									<span className='text-muted-foreground'>Plan:</span> <span className={`${effectivePlan === Plan.Free ? "text-green-600" : "text-primary-400"}`}>{effectivePlanLabel}</span>
								</p>
							</div>
						</div>
						{canUpgradeFromBilling && (
							<Button color='primary' startContent={<IconDiamondFilled />} isDisabled={!canUpgradeFromBilling} onPress={upgradeModalOnOpen} aria-label='Upgrade Account'>
								Upgrade Account
							</Button>
						)}
						{user.plan !== Plan.Free && (
							<Button
								color='primary'
								startContent={<IconCreditCardFilled />}
								onPress={async () => {
									const link = await getPortalLink(user);
									if (link) {
										window.location.href = link;
									} else {
										addToast({
											title: "Error",
											description: "Failed to generate portal link. Please try again later.",
											color: "danger",
										});
									}
								}}
							>
								Manage Subscription
							</Button>
						)}
						<Divider className='my-4' />
						<Card className='border border-default-200 bg-default-50/60'>
							<CardBody className='gap-3'>
								<div className='flex items-center justify-between gap-2'>
									<div className='flex items-center gap-2'>
										<IconDatabase className='text-default-500' />
										<div>
											<p className='font-semibold text-sm'>Clip Crawl Status</p>
											<p className='text-xs text-default-500'>Your clip cache is checked in the background about every minute.</p>
										</div>
									</div>
									<span className={`text-xs font-semibold ${clipCacheStatus?.backfillComplete ? "text-success-600" : "text-warning-600"}`}>{clipCacheStatus?.backfillComplete ? "Complete" : "Syncing"}</span>
								</div>
								<div className='flex flex-wrap items-center justify-between gap-2'>
									<p className='text-xs text-default-500'>
										Manual refresh: {clipForceRefreshStatus?.canRefresh ? "available now" : `available in ${formatDurationMs(clipForceRefreshStatus?.remainingMs ?? 0)}`}
									</p>
									<div className='flex items-center gap-2'>
										<Tooltip content='Refresh statistics'>
											<Button isIconOnly size='sm' variant='flat' onPress={handleRefreshStats} isLoading={isRefreshingStats} aria-label='Refresh statistics'>
												<IconRefresh size={18} />
											</Button>
										</Tooltip>
										<Button
											size='sm'
											color='secondary'
											variant='shadow'
											className='font-semibold'
											isLoading={isForceRefreshing}
											isDisabled={isForceRefreshing || !clipForceRefreshStatus?.canRefresh}
											onPress={handleForceRefreshCache}
										>
											Force Refresh Cache
										</Button>
									</div>
								</div>
								<div className='w-full h-2 rounded-full bg-default-200 overflow-hidden'>
									<div className='h-full bg-gradient-to-r from-primary-700 to-primary-400' style={{ width: `${clipCacheStatus?.estimatedCoveragePercent ?? 0}%` }} />
								</div>
								<p className='text-xs text-default-500'>Cached clips are stored clip records used by the player so playback works quickly without refetching everything from Twitch on each request.</p>
								<div className='grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-default-600'>
									<p>
										<span className='font-semibold'>Backfill progress (estimate):</span> {clipCacheStatus?.estimatedCoveragePercent ?? 0}%
									</p>
									<p>
										<span className='font-semibold'>Cached clips:</span> {clipCacheStatus?.cachedClipCount ?? 0}
									</p>
									<p>
										<span className='font-semibold'>Unavailable clips:</span> {clipCacheStatus?.unavailableClipCount ?? 0}
									</p>
									<p>
										<span className='font-semibold'>Oldest cached clip:</span> {formatStatusDate(clipCacheStatus?.oldestClipDate)}
									</p>
									<p>
										<span className='font-semibold'>Last fresh sync:</span> {formatStatusDate(clipCacheStatus?.lastIncrementalSyncAt)}
									</p>
									<p>
										<span className='font-semibold'>Last backfill sync:</span> {formatStatusDate(clipCacheStatus?.lastBackfillSyncAt)}
									</p>
									<p>
										<span className='font-semibold'>Last manual refresh:</span> {formatStatusDate(clipForceRefreshStatus?.lastForcedAt)}
									</p>
								</div>
							</CardBody>
						</Card>
						<p className='mb-6 text-xs text-default-500'>New clips are usually picked up within several minutes, and older clips are added in batches every few minutes until full history catch-up is done.</p>

						<Form className='w-full' onSubmit={handleSubmit}>
							<Input
								label='Command Prefix'
								type='text'
								value={settings?.prefix || ""}
								description='Maximum of 3 characters. This prefix will be used for all bot commands.'
								maxLength={3}
								onChange={(e) => {
									if (!settings) {
										return;
									}
									const value = e.target.value.trim();
									if (value.length <= 3) {
										setSettings({ ...settings, prefix: value });
									}
								}}
								required
							/>
							<div className='w-full rounded-medium border border-default-200 bg-default-50/40 p-3'>
								<div className='flex items-start justify-between gap-4'>
									<div>
										<p className='font-semibold text-sm'>Email Preferences</p>
										<p className='text-xs text-default-500'>Product updates and occasional special offers.</p>
									</div>
									<Switch
										isSelected={receivesProductUpdates}
										isDisabled={!settings}
										onValueChange={(value) => {
											if (!settings) {
												return;
											}
											setSettings({
												...settings,
												marketingOptIn: value,
												marketingOptInSource: value ? "settings_page_explicit_optin" : "settings_page_optout",
											});
										}}
									>
										Receive emails
									</Switch>
								</div>
								<p className='mt-2 text-xs text-default-500'>Opt out anytime here or by using the unsubscribe link in any email.</p>
								{settings?.marketingOptInAt && <p className='mt-1 text-xs text-default-500'>Consent recorded on {new Date(settings.marketingOptInAt).toLocaleString()}.</p>}
							</div>

							{isEffectivelyFree && !editorsAccess.allowed && (
								<div className='w-full mb-4'>
									<Card className='bg-warning-50 border border-warning-200 mb-2'>
										<CardBody>
											<div className='flex items-center gap-2 mb-1'>
												<IconCrown className='text-warning-500' />
												<span className='text-warning-800 font-semibold text-base'>Pro Feature Locked</span>
											</div>
											<p className='text-sm text-warning-700'>
												Unlock advanced settings with <span className='font-semibold'>Pro</span>.
											</p>
											<ul className='list-disc list-inside text-warning-700 text-xs mt-2 ml-1'>
												<li>Grant editors permission to manage your overlays</li>
												<li>Remote control panel for live playback</li>
												<li>Priority support</li>
											</ul>
											<Button
												color='warning'
												variant='shadow'
												onPress={async () => {
													if (!user) return;
													trackPaywallEvent(plausible, "paywall_cta_click", {
														source: "paywall_banner",
														feature: "editors",
														plan: user.plan,
														cycle: "yearly",
													});

													const link = await generatePaymentLink(user, "yearly", window.location.href, window.numok?.getStripeMetadata(), "paywall_banner");

													if (link) {
														trackPaywallEvent(plausible, "checkout_start", {
															source: "paywall_banner",
															feature: "editors",
															plan: user.plan,
															cycle: "yearly",
														});
														window.location.href = link;
													} else {
														addToast({
															title: "Error",
															description: "Failed to generate payment link. Please try again later.",
															color: "danger",
														});
													}
												}}
												className='mt-3 w-full font-semibold'
											>
												Upgrade to Pro
											</Button>
											<p className='text-xs text-warning-600 text-center mt-2'>{inTrial ? `Trial active: ${trialDaysLeft <= 1 ? "ends today." : `${trialDaysLeft} days left.`}` : "Start Pro now. Cancel anytime."}</p>
										</CardBody>
									</Card>
								</div>
							)}
							<div
								className='w-full'
								style={{
									filter: isEffectivelyFree && !editorsAccess.allowed ? "blur(1.5px)" : "none",
									pointerEvents: isEffectivelyFree && !editorsAccess.allowed ? "none" : "auto",
								}}
							>
								<TagsInput
									fullWidth
									maxInputs={5}
									label='Edit editors'
									description={"Twitch usernames of users you want to grant permission to manage your overlays. Editors can modify, create and delete overlays on your behalf."}
									value={settings?.editors}
									validate={(value) => {
										for (const name of value) {
											if (!/^[A-Za-z0-9_]{4,25}$/.test(name)) {
												return `Invalid Twitch username: '${name}' (use 4-25 chars, only letters/numbers/_)`;
											}

											if (name.toLowerCase() === user.username.toLowerCase()) {
												return `You cannot add yourself as an editor.`;
											}
										}
										return null;
									}}
									onValueChange={(editors) => {
										if (!settings) {
											return;
										}
										setSettings({ ...settings, editors });
									}}
								/>
							</div>

							<Button type='submit' color='primary' className='mt-4' fullWidth isDisabled={!isFormDirty()} aria-label='Save Settings' startContent={<IconDeviceFloppy />}>
								Save Settings
							</Button>
						</Form>
						<Divider className='my-4' />
						<div className='flex  flex-col gap-2 justify-end'>
							<Button
								color='danger'
								startContent={<IconTrash />}
								isDisabled={user.plan !== Plan.Free}
								onPress={async () => {
									if (await checkIfSubscriptionExists(user)) {
										return addToast({
											title: "Active Subscription",
											description: "You have an active subscription. Please cancel it before deleting your account.",
											color: "danger",
										});
									}
									deleteModalOnOpen();
								}}
							>
								Delete Account
							</Button>
							{user.plan !== Plan.Free && <span className='text-sm text-gray-500'>You must cancel your subscription and wait for it to expire before deleting your account.</span>}
						</div>
					</CardBody>
				</Card>
			</DashboardNavbar>

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
							You&apos;ve made changes to your <span className='font-semibold text-default-900'> settings</span> that haven&apos;t been saved. If you go back now, <span className='font-semibold text-danger'>those changes will be lost</span>.
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

			<UpgradeModal key={`${upgradeIntent.source}-${upgradeIntent.feature}-${upgradeIntent.cycle}`} isOpen={upgradeModalIsOpen} onOpenChange={upgradeModalOnOpenChange} user={user} title='Upgrade Account' source={upgradeIntent.source} feature={upgradeIntent.feature} initialBillingCycle={upgradeIntent.cycle} />

			<ConfirmModal
				isOpen={deleteModalIsOpen}
				onOpenChange={deleteModalOnOpenChange}
				keyword={user.username}
				onConfirm={async () => {
					addToast({
						title: "Deleting...",
						description: "Your account is being deleted. You will be redirected soon.",
						color: "danger",
					});

					await deleteUser(user.id);
					router.push("/logout");
				}}
			/>
		</>
	);
}

