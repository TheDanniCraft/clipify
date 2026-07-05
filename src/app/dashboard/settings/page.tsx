"use client";

import { validateAuth } from "@actions/auth";
import { deleteUser, getClipCacheStatus, getSettings, saveSettings } from "@actions/database";
import ConfirmModal from "@components/confirmModal";
import DashboardNavbar from "@components/dashboardNavbar";
import CodeSnippet from "@components/codeSnippet";
import FullscreenLoadingState from "@components/fullscreenLoadingState";
import { AuthenticatedUser, Plan, UserSettings } from "@types";
import { Alert, Avatar, Button, Card, Separator, Form, Input, Modal, Spinner, Switch, Tooltip, useOverlayState, TextField, Label, Description, FieldError } from "@heroui/react";
import { notify as addToast } from "@lib/toast";

import { IconAlertTriangle, IconArrowLeft, IconCreditCardFilled, IconDatabase, IconDeviceFloppy, IconDiamondFilled, IconInfoCircle, IconRefresh, IconTrash } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { generatePaymentLink, checkIfSubscriptionExists, getPortalLink } from "@actions/subscription";
import { forceRefreshOwnClipCache, getOwnClipForceRefreshStatus } from "@actions/twitch";
import { useNavigationGuard } from "next-navigation-guard";
import UpgradeModal from "@components/upgradeModal";
import TagsInput from "@components/tagsInput";
import ChatwootData from "@components/chatwootData";
import ControlledModal from "@components/controlledModal";
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
	const { isOpen: upgradeModalIsOpen, open: upgradeModalOnOpen, setOpen: upgradeModalOnOpenChange } = useOverlayState();
	const { isOpen: deleteModalIsOpen, open: deleteModalOnOpen, setOpen: deleteModalOnOpenChange } = useOverlayState();
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
	const showOnCommunityPage = settings?.showOnCommunityPage ?? false;

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
		return <FullscreenLoadingState message='Loading settings' />;
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
					<Card.Header>
						<div className='flex items-center gap-2 w-full justify-between'>
							<Button isIconOnly variant='tertiary' onPress={() => router.push("/dashboard")} aria-label='Back to Dashboard'>{<IconArrowLeft />}</Button>
							<div className='flex items-center gap-2'>
								<div className='flex items-center overflow-hidden'>
									<CodeSnippet
										size='sm'
										symbol='User ID:'
										preClassName='overflow-hidden whitespace-nowrap'
									>
										{user.id}
									</CodeSnippet>
								</div>
								<Tooltip delay={0}>
									<Tooltip.Trigger><IconInfoCircle size={20} className='text-muted' /></Tooltip.Trigger>
									<Tooltip.Content>If you contact support, please specify this user ID.</Tooltip.Content>
								</Tooltip>
							</div>
						</div>
					</Card.Header>
					<Card.Content className='px-6 pt-0 pb-6'>
						<div className='mb-5 flex items-center'>
							<Avatar size='lg' className='mr-4'>
								<Avatar.Image alt={user.username} src={user.avatar} />
								<Avatar.Fallback>{user.username.slice(0, 2).toUpperCase()}</Avatar.Fallback>
							</Avatar>
							<div>
								<p className='text-2xl font-bold'>{user.username}</p>
								<p className='text-sm font-bold text-muted'>
									<span>Plan:</span> <span className={`${effectivePlan === Plan.Free ? "text-success" : "text-brand-400"}`}>{effectivePlanLabel}</span>
								</p>
							</div>
						</div>
						<div className='mb-6 flex flex-wrap gap-3'>
							{canUpgradeFromBilling && (
								<Button isDisabled={!canUpgradeFromBilling} onPress={upgradeModalOnOpen} aria-label='Upgrade Account' variant='primary'>{<IconDiamondFilled />}
									Upgrade Account
								</Button>
							)}
							{user.plan !== Plan.Free && (
								<Button onPress={async () => {
										const link = await getPortalLink();
										if (link) {
											window.location.href = link;
										} else {
											addToast({
												title: "Error",
												description: "Failed to generate portal link. Please try again later.",
												color: "danger",
											});
										}
									}} variant='primary'>{<IconCreditCardFilled />}
									Manage Subscription
								</Button>
							)}
						</div>

						<Separator className='my-6' />

						<div className='space-y-6'>
							<section className='space-y-3'>
								<div className='flex items-center justify-between gap-3'>
									<div className='flex items-center gap-2'>
										<IconDatabase className='text-muted' />
										<div>
											<p className='font-semibold text-sm'>Clip crawl status</p>
											<p className='text-xs text-muted'>Your clip cache is checked in the background about every minute.</p>
										</div>
									</div>
									<span className={`text-xs font-semibold ${clipCacheStatus?.backfillComplete ? "text-success" : "text-warning"}`}>{clipCacheStatus?.backfillComplete ? "Complete" : "Syncing"}</span>
								</div>
								<div className='flex flex-wrap items-center justify-between gap-2'>
									<p className='text-xs text-muted'>
										Manual refresh: {clipForceRefreshStatus?.canRefresh ? "available now" : `available in ${formatDurationMs(clipForceRefreshStatus?.remainingMs ?? 0)}`}
									</p>
									<div className='flex items-center gap-2'>
										<Tooltip delay={0}>
											<Tooltip.Trigger><Button isIconOnly size='sm' variant='tertiary' onPress={handleRefreshStats} isPending={isRefreshingStats} aria-label='Refresh statistics'>
												{isRefreshingStats ? <Spinner color='current' size='sm' /> : <IconRefresh size={18} />}
											</Button></Tooltip.Trigger>
											<Tooltip.Content>Refresh statistics</Tooltip.Content>
										</Tooltip>
										<Button size='sm' variant='danger' className='font-semibold' isPending={isForceRefreshing} isDisabled={isForceRefreshing || !clipForceRefreshStatus?.canRefresh} onPress={handleForceRefreshCache}>
											{isForceRefreshing ? <Spinner color='current' size='sm' /> : null}
											Force Refresh Cache
										</Button>
									</div>
								</div>
								<div className='h-2 w-full overflow-hidden rounded-full bg-default'>
									<div className='h-full bg-gradient-to-r from-brand-700 to-brand-400' style={{ width: `${clipCacheStatus?.estimatedCoveragePercent ?? 0}%` }} />
								</div>
								<p className='text-xs text-muted'>Cached clips are stored clip records used by the player so playback works quickly without refetching everything from Twitch on each request.</p>
								<div className='grid grid-cols-1 gap-2 text-xs text-muted md:grid-cols-2'>
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
							</section>

							<Separator />

							<Form className='flex w-full flex-col gap-4' onSubmit={handleSubmit}>
								<TextField fullWidth variant='secondary' type='text' isRequired><Label>Command Prefix</Label><Input className='w-full' value={settings?.prefix || ""} maxLength={3} onChange={(e) => {
										if (!settings) {
											return;
										}
										const value = e.target.value.trim();
										if (value.length <= 3) {
											setSettings({ ...settings, prefix: value });
										}
									}} /><Description>Maximum of 3 characters. This prefix will be used for all bot commands.</Description><FieldError /></TextField>
								<Card variant='secondary' className='w-full'>
									<Card.Content>
									<div className='flex items-center justify-between gap-4'>
										<div>
											<p className='font-semibold text-sm'>Email Preferences</p>
											<p className='text-xs text-muted'>Product updates and occasional special offers.</p>
										</div>
										<Switch
											isSelected={receivesProductUpdates}
											isDisabled={!settings}
											aria-label='Receive emails'
											onChange={(value) => {
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
											<Switch.Content><Switch.Control><Switch.Thumb /></Switch.Control></Switch.Content>
										</Switch>
									</div>
									<p className='mt-2 text-xs text-muted'>Opt out anytime here or by using the unsubscribe link in any email.</p>
									{settings?.marketingOptInAt && <p className='mt-1 text-xs text-muted'>Consent recorded on {new Date(settings.marketingOptInAt).toLocaleString()}.</p>}
									</Card.Content>
								</Card>
								<Card variant='secondary' className='w-full'>
									<Card.Content>
									<div className='flex items-center justify-between gap-4'>
										<div>
											<p className='font-semibold text-sm'>Community Page</p>
											<p className='text-xs text-muted'>Opt in to appear on the public community page with your Twitch handle and channel link.</p>
										</div>
										<Switch
											isSelected={showOnCommunityPage}
											isDisabled={!settings}
											aria-label='Show on community page'
											onChange={(value) => {
												if (!settings) {
													return;
												}
												setSettings({
													...settings,
													showOnCommunityPage: value,
												});
											}}
										>
											<Switch.Content><Switch.Control><Switch.Thumb /></Switch.Control></Switch.Content>
										</Switch>
									</div>
									<p className='mt-2 text-xs text-muted'>Show up on the public community page with your Twitch handle and channel link.</p>
									</Card.Content>
								</Card>

								{isEffectivelyFree && !editorsAccess.allowed && (
									<div className='w-full mb-4'>
										<Alert status='warning'>
											<Alert.Content>
												<Alert.Title>Pro Feature Locked</Alert.Title>
												<Alert.Description>
													Unlock advanced settings with <span className='font-semibold'>Pro</span>.
												</Alert.Description>
												<ul className='list-disc list-inside text-xs mt-2 ml-1'>
													<li>Grant editors permission to manage your overlays</li>
													<li>Remote control panel for live playback</li>
													<li>Priority support</li>
												</ul>
												<Button variant='primary' onPress={async () => {
														if (!user) return;
														trackPaywallEvent(plausible, "paywall_cta_click", {
															source: "paywall_banner",
															feature: "editors",
															plan: user.plan,
															cycle: "yearly",
														});

														const link = await generatePaymentLink("yearly", window.location.href, window.numok?.getStripeMetadata(), "paywall_banner");

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
													}} className='mt-3 w-full font-semibold'>
													Upgrade to Pro
												</Button>
												<p className='text-xs text-center mt-2'>{inTrial ? `Trial active: ${trialDaysLeft <= 1 ? "ends today." : `${trialDaysLeft} days left.`}` : "Start Pro now. Cancel anytime."}</p>
											</Alert.Content>
										</Alert>
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
										description='Twitch usernames of users you want to grant permission to manage your overlays. Editors can modify, create and delete overlays on your behalf.'
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

								<Button fullWidth type='submit' isDisabled={!isFormDirty()} aria-label='Save Settings' variant='primary'>{<IconDeviceFloppy />}
									Save Settings
								</Button>
							</Form>
							<Separator className='my-4' />
							<div className='flex  flex-col gap-2 justify-end'>
								<Button fullWidth isDisabled={user.plan !== Plan.Free} onPress={async () => {
										if (await checkIfSubscriptionExists()) {
											return addToast({
												title: "Active Subscription",
												description: "You have an active subscription. Please cancel it before deleting your account.",
												color: "danger",
											});
										}
										deleteModalOnOpen();
									}} variant='danger'>{<IconTrash />}
									Delete Account
								</Button>
								{user.plan !== Plan.Free && <span className='text-sm text-gray-500'>You must cancel your subscription and wait for it to expire before deleting your account.</span>}
							</div>
						</div>
					</Card.Content>
				</Card>
			</DashboardNavbar>

			<ControlledModal variant='blur' isOpen={navGuard.active} onClose={navGuard.reject}>
					<Modal.Header>
						<Modal.Heading className='flex items-center'>
							<IconAlertTriangle className='mr-2' />
							Unsaved Changes
						</Modal.Heading>
					</Modal.Header>
					<Modal.Body>
						<p className='text-sm text-foreground'>
							You&apos;ve made changes to your <span className='font-semibold text-foreground'> settings</span> that haven&apos;t been saved. If you go back now, <span className='font-semibold text-danger'>those changes will be lost</span>.
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

