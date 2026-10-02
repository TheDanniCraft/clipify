"use client";

import { validateAuth } from "@actions/auth";
import { getClipCacheStatus, getSettings, saveSettings } from "@actions/database";
import ConfirmModal from "@components/confirmModal";
import DashboardNavbar from "@components/dashboardNavbar";
import DashboardUserAvatar from "@components/dashboardUserAvatar";
import CodeSnippet from "@components/codeSnippet";
import FullscreenLoadingState from "@components/fullscreenLoadingState";
import { AuthenticatedUser, Plan, UserSettings } from "@types";
import { Alert, Button, Card, Separator, Form, Input, Link, Modal, Spinner, Switch, Tooltip, useOverlayState, TextField, TextArea, Label, Description, FieldError } from "@heroui/react";
import { notify as addToast } from "@lib/toast";

import { IconAlertTriangle, IconDatabase, IconDeviceFloppy, IconInfoCircle, IconRefresh, IconTrash } from "@tabler/icons-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { exportAccountData, requestAccountDeletion } from "@actions/subscription";
import { forceRefreshOwnClipCache, getOwnClipForceRefreshStatus } from "@actions/twitch";
import { useNavigationGuard } from "nextjs-nav-guard";
import UpgradeModal from "@components/upgradeModal";
import BillingPanel from "./billing-panel";
import ChatwootData from "@components/chatwootData";
import ControlledModal from "@components/controlledModal";
import CreatorAnalyticsCard from "@components/creator/CreatorAnalyticsCard";
import SettingsNavigation from "@components/settingsNavigation";
import { getFeatureAccess, getTrialDaysLeft, isReverseTrialActive } from "@lib/featureAccess";
import type { BillingCycle, PaywallSource } from "@actions/subscription";
import { authClient } from "@/auth/client";
import { IconBrandTwitch } from "@tabler/icons-react";

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

type SettingsSection = "settings" | "creator" | "billing";

export default function SettingsPage() {
	const [user, setUser] = useState<AuthenticatedUser | null>(null);
	const { isOpen: upgradeModalIsOpen, open: upgradeModalOnOpen, setOpen: upgradeModalOnOpenChange } = useOverlayState();
	const [upgradeMode] = useState<"plan" | "runner_addon">(() => {
		if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("addon") === "runner") return "runner_addon";
		return "plan";
	});
	const [sectionTab, setSectionTab] = useState<SettingsSection>("settings");
	const { isOpen: deleteModalIsOpen, open: deleteModalOnOpen, setOpen: deleteModalOnOpenChange } = useOverlayState();
	const [deletionChoice, setDeletionChoice] = useState<"paid_through" | "immediate">("paid_through");
	const [timer, setTimer] = useState<number>(0);
	const [settings, setSettings] = useState<UserSettings | null>(null);
	const [baseSettings, setBaseSettings] = useState<UserSettings | null>(null);
	const [clipCacheStatus, setClipCacheStatus] = useState<ClipCacheStatusState | null>(null);
	const [clipForceRefreshStatus, setClipForceRefreshStatus] = useState<ClipForceRefreshStatusState>(null);
	const [isForceRefreshing, setIsForceRefreshing] = useState(false);
	const [isRefreshingStats, setIsRefreshingStats] = useState(false);
	const [recentAuthAction, setRecentAuthAction] = useState<"export" | "deletion" | null>(null);
	const [isReauthenticating, setIsReauthenticating] = useState(false);

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
	const canUpgradeFromBilling = user?.plan === Plan.Free;
	const receivesProductUpdates = Boolean(settings?.marketingOptIn);
	const creatorPageDiscoverable = settings?.creatorPageVisibility ? settings.creatorPageVisibility === "discoverable" : (settings?.showOnCommunityPage ?? false);
	const creatorSocialTitle = settings?.creatorPageSocialTitle?.trim() || `${user?.username ?? "Creator"}'s Twitch clips`;
	const creatorSocialDescription = settings?.creatorPageSocialDescription?.trim() || `Watch clips from ${user?.username ?? "this creator"} on Clipify.`;

	useEffect(() => {
		let cancelled = false;
		queueMicrotask(() => {
			if (cancelled) return;
			const params = new URLSearchParams(window.location.search);
			const reauthenticated = params.get("reauthenticated");
			if (reauthenticated) {
				addToast({ title: "Identity confirmed", description: reauthenticated === "export" ? "You can export your account data now." : reauthenticated === "deletion" ? "You can schedule account deletion now." : "You can continue with the sensitive account action.", color: "success" });
				params.delete("reauthenticated");
				router.replace(params.size ? `/dashboard/settings?${params.toString()}` : "/dashboard/settings");
			}
			const requestedTab = params.get("tab");
			if (requestedTab === "creator" || requestedTab === "billing") setSectionTab(requestedTab);
			else if (requestedTab === "badges" || requestedTab === "achievements") router.replace("/dashboard/member-card");
			else if (params.has("billing") || params.has("checkout") || params.get("addon") === "runner") setSectionTab("billing");
		});
		return () => {
			cancelled = true;
		};
	}, [router]);

	useEffect(() => {
		if (!user || typeof window === "undefined") return;
		const params = new URLSearchParams(window.location.search);
		if (!params.has("upgrade") || !canUpgradeFromBilling) return;
		upgradeModalOnOpen();
	}, [canUpgradeFromBilling, upgradeModalOnOpen, user]);

	useEffect(() => {
		if (!user || user.entitlements?.runnerAccess || typeof window === "undefined") return;
		const params = new URLSearchParams(window.location.search);
		if (params.get("addon") !== "runner") return;
		upgradeModalOnOpen();
	}, [upgradeModalOnOpen, user]);

	const creatorAnalyticsAccess = user ? getFeatureAccess(user, "creator_page_analytics") : { allowed: false as const };
	const creatorSocialPreviewAccess = user ? getFeatureAccess(user, "creator_page_social_preview") : { allowed: false as const };
	const inTrial = user ? isReverseTrialActive(user) : false;
	const trialDaysLeft = user ? getTrialDaysLeft(user) : 0;
	const trialSummaryLabel = trialDaysLeft <= 1 ? "Ends today" : `${trialDaysLeft} days left`;
	const effectivePlanLabel = inTrial ? `Pro (trial ${trialSummaryLabel})` : effectivePlan === Plan.Pro ? "Pro" : "Free";

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

	async function reauthenticateWithTwitch() {
		setIsReauthenticating(true);
		const callbackURL = `/dashboard/settings?reauthenticated=${recentAuthAction ?? "sensitive-action"}`;
		const result = await authClient.signIn.social({ provider: "twitch", callbackURL, errorCallbackURL: "/dashboard/settings?reauthentication=failed" });
		if (result.error) {
			setIsReauthenticating(false);
			addToast({ title: "Identity check could not start", description: "Please retry the Twitch verification.", color: "danger" });
		}
	}

	return (
		<>
			<ChatwootData user={user} />

			<DashboardNavbar user={user} title='Settings' tagline='Manage your settings'>
				<div className='mt-4 flex w-full flex-col gap-2'>
					<SettingsNavigation active={sectionTab} onCoreSectionChange={setSectionTab} />
				</div>
				{sectionTab === "billing" ? (
					<BillingPanel />
				) : sectionTab === "creator" ? (
					<Card className='mt-4'>
						<Card.Header>
							<p className='text-xl font-semibold'>Creator Page</p>
							<p className='text-sm text-muted'>Manage your public Clipify profile, discovery visibility, and analytics.</p>
						</Card.Header>
						<Separator />
						<Card.Content className='flex flex-col gap-6 p-6'>
							<Form className='flex w-full flex-col gap-6' onSubmit={handleSubmit}>
								<section className='space-y-4' aria-labelledby='creator-page-availability-heading'>
									<div>
										<h3 id='creator-page-availability-heading' className='text-base font-semibold'>
											Page availability
										</h3>
										<p className='text-xs text-muted'>Control your shareable Creator Page and the profile information shown on it.</p>
									</div>
									<div className='flex items-center justify-between gap-6'>
										<div className='min-w-0'>
											<p className='text-sm font-semibold'>Enable Creator Page</p>
											<p className='text-xs text-muted'>Your shareable Clipify profile with all cached clips, Twitch details, and live status.</p>
											{settings?.creatorPageEnabled !== false ? (
												<Link className='mt-2 text-xs' href={`/creators/${encodeURIComponent(user.username)}`} target='_blank' rel='noopener noreferrer'>
													Open Creator Page
													<Link.Icon />
												</Link>
											) : null}
										</div>
										<Switch isSelected={settings?.creatorPageEnabled !== false} isDisabled={!settings} aria-label='Enable creator page' onChange={(value) => settings && setSettings({ ...settings, creatorPageEnabled: value })}>
											<Switch.Content>
												<Switch.Control>
													<Switch.Thumb />
												</Switch.Control>
											</Switch.Content>
										</Switch>
									</div>
									<Separator />
									<div className='flex items-center justify-between gap-6'>
										<div className='min-w-0'>
											<p className='text-sm font-semibold'>Show Twitch bio</p>
											<p className='text-xs text-muted'>Use your Twitch channel description in the profile card.</p>
										</div>
										<Switch isSelected={settings?.creatorPageShowBio !== false} isDisabled={!settings || settings.creatorPageEnabled === false} aria-label='Show Twitch bio' onChange={(value) => settings && setSettings({ ...settings, creatorPageShowBio: value })}>
											<Switch.Content>
												<Switch.Control>
													<Switch.Thumb />
												</Switch.Control>
											</Switch.Content>
										</Switch>
									</div>
								</section>
								<Separator />
								<section className='space-y-4' aria-labelledby='creator-social-preview-heading'>
									<div>
										<h3 id='creator-social-preview-heading' className='text-base font-semibold'>
											Social preview
										</h3>
										<p className='text-xs text-muted'>Preview and customize how your Creator Page appears when its link is shared.</p>
									</div>
									<div className='grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]'>
										{creatorSocialPreviewAccess.allowed ? (
											<div className='space-y-3'>
												<TextField value={settings?.creatorPageSocialTitle ?? ""} onChange={(value) => settings && setSettings({ ...settings, creatorPageSocialTitle: value })} variant='secondary' maxLength={120} isDisabled={!settings || settings.creatorPageEnabled === false}>
													<Label>Preview title</Label>
													<Input placeholder={`${user.username}'s Twitch clips`} />
													<Description>Optional, up to 120 characters.</Description>
												</TextField>
												<TextField value={settings?.creatorPageSocialDescription ?? ""} onChange={(value) => settings && setSettings({ ...settings, creatorPageSocialDescription: value })} variant='secondary' maxLength={240} isDisabled={!settings || settings.creatorPageEnabled === false}>
													<Label>Preview description</Label>
													<TextArea rows={3} placeholder={`Watch clips from ${user.username} on Clipify.`} />
													<Description>Optional, up to 240 characters.</Description>
												</TextField>
											</div>
										) : (
											<Alert status='warning'>
												<Alert.Content>
													<Alert.Title>Custom social previews are a Pro feature</Alert.Title>
													<Alert.Description>Upgrade to control the title and description shown when people share your Creator Page.</Alert.Description>
												</Alert.Content>
												<Button size='sm' variant='tertiary' onPress={upgradeModalOnOpen}>
													Upgrade to Pro
												</Button>
											</Alert>
										)}
										<div className='overflow-hidden rounded-xl border border-default/60 bg-surface-secondary shadow-sm' aria-label='Social preview example'>
											<div className='relative aspect-[1.91/1] bg-background'>
												<Image src='/og-image.png' alt='Clipify social preview image' fill sizes='(min-width: 1024px) 40vw, 100vw' className='object-cover' />
											</div>
											<div className='space-y-1 p-4'>
												<p className='line-clamp-2 text-sm font-semibold'>{creatorSocialTitle}</p>
												<p className='line-clamp-2 text-xs text-muted'>{creatorSocialDescription}</p>
												<p className='pt-1 text-[11px] uppercase tracking-wide text-muted'>clipify.us</p>
											</div>
										</div>
									</div>
								</section>
								<Separator />
								<p className='text-xs text-muted'>
									Search-engine and Clipify Discovery visibility is managed under <Link onPress={() => setSectionTab("settings")}>Settings</Link>.
								</p>
								<Button fullWidth type='submit' isDisabled={!isFormDirty()} aria-label='Save Creator Page Settings' variant='primary'>
									<IconDeviceFloppy /> Save Creator Page Settings
								</Button>
							</Form>
							<Separator />
							<div>
								<h3 className='mb-3 text-base font-semibold'>Creator Page Analytics</h3>
								<CreatorAnalyticsCard allowed={creatorAnalyticsAccess.allowed} onUpgrade={upgradeModalOnOpen} />
							</div>
						</Card.Content>
					</Card>
				) : (
					<Card className='mt-4'>
						<Card.Header>
							<div className='flex w-full items-center justify-end'>
								<div className='flex items-center gap-2'>
									<div className='flex items-center overflow-hidden'>
										<CodeSnippet size='sm' symbol='User ID:' preClassName='overflow-hidden whitespace-nowrap'>
											{user.id}
										</CodeSnippet>
									</div>
									<Tooltip delay={0}>
										<Tooltip.Trigger>
											<IconInfoCircle size={20} className='text-muted' />
										</Tooltip.Trigger>
										<Tooltip.Content>If you contact support, please specify this user ID.</Tooltip.Content>
									</Tooltip>
								</div>
							</div>
						</Card.Header>
						<Card.Content className='px-6 pt-0 pb-6'>
							<div className='mb-5 flex items-center gap-3'>
								<DashboardUserAvatar username={user.username} avatar={user.avatar} />
								<div>
									<p className='text-2xl font-bold'>{user.username}</p>
									<p className='text-sm font-bold text-muted'>
										<span>Plan:</span> <span className={`${effectivePlan === Plan.Free ? "text-success" : "text-brand-400"}`}>{effectivePlanLabel}</span>
									</p>
								</div>
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
										<p className='text-xs text-muted'>Manual refresh: {clipForceRefreshStatus?.canRefresh ? "available now" : `available in ${formatDurationMs(clipForceRefreshStatus?.remainingMs ?? 0)}`}</p>
										<div className='flex items-center gap-2'>
											<Tooltip delay={0}>
												<Tooltip.Trigger>
													<Button isIconOnly size='sm' variant='tertiary' onPress={handleRefreshStats} isPending={isRefreshingStats} aria-label='Refresh statistics'>
														{isRefreshingStats ? <Spinner color='current' size='sm' /> : <IconRefresh size={18} />}
													</Button>
												</Tooltip.Trigger>
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
									<TextField fullWidth variant='secondary' type='text' isRequired>
										<Label>Command Prefix</Label>
										<Input
											className='w-full'
											value={settings?.prefix || ""}
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
										/>
										<Description>Maximum of 3 characters. This prefix will be used for all bot commands.</Description>
										<FieldError />
									</TextField>
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
													<Switch.Content>
														<Switch.Control>
															<Switch.Thumb />
														</Switch.Control>
													</Switch.Content>
												</Switch>
											</div>
											<p className='mt-2 text-xs text-muted'>Opt out anytime here or by using the unsubscribe link in any email.</p>
											{settings?.marketingOptInAt && <p className='mt-1 text-xs text-muted'>Consent recorded on {new Date(settings.marketingOptInAt).toLocaleString()}.</p>}
										</Card.Content>
									</Card>
									<Card variant='secondary' className='w-full'>
										<Card.Content>
											<div className='flex items-center justify-between gap-4'>
												<div className='min-w-0'>
													<p className='text-sm font-semibold'>Search engines and Clipify Discovery</p>
													<p className='text-xs text-muted'>Controls whether your Creator Page appears in search, the sitemap, and Clipify discovery. The direct URL continues to work when disabled.</p>
												</div>
												<Switch isSelected={creatorPageDiscoverable} isDisabled={!settings || settings.creatorPageEnabled === false} aria-label='Appear in search engines and Clipify Discovery' onChange={(value) => settings && setSettings({ ...settings, showOnCommunityPage: value, creatorPageVisibility: value ? "discoverable" : "unlisted" })}>
													<Switch.Content>
														<Switch.Control>
															<Switch.Thumb />
														</Switch.Control>
													</Switch.Content>
												</Switch>
											</div>
											<p className='mt-2 text-xs text-muted'>
												Creator Page availability and profile content are configured in the <Link onPress={() => setSectionTab("creator")}>Creator Page tab</Link>.
											</p>
										</Card.Content>
									</Card>
									<Card variant='secondary' className='w-full'>
										<Card.Content>
											<div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
												<div>
													<p className='text-sm font-semibold'>Sign-in &amp; security</p>
													<p className='text-xs text-muted'>Change your account email and manage passkeys.</p>
												</div>
												<Button variant='secondary' onPress={() => router.push("/dashboard/settings/security")}>
													Manage security
												</Button>
											</div>
										</Card.Content>
									</Card>
									<Card variant='secondary' className='w-full'>
										<Card.Content>
											<div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
												<div>
													<p className='text-sm font-semibold'>Team access</p>
													<p className='text-xs text-muted'>Invite team members and assign preset or custom permissions.</p>
												</div>
												<Button variant='secondary' onPress={() => router.push("/dashboard/settings/team")}>
													Manage team
												</Button>
											</div>
										</Card.Content>
									</Card>

									<Button fullWidth type='submit' isDisabled={!isFormDirty()} aria-label='Save Settings' variant='primary'>
										{<IconDeviceFloppy />}
										Save Settings
									</Button>
								</Form>
								<Separator className='my-4' />
								<div className='flex  flex-col gap-2 justify-end'>
									<Button
										fullWidth
										variant='secondary'
										onPress={async () => {
											try {
												const data = await exportAccountData();
												const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
												const link = document.createElement("a");
												link.href = url;
												link.download = `clipify-account-${user.id}.json`;
												link.click();
												URL.revokeObjectURL(url);
											} catch (error) {
												if (error instanceof Error && error.message === "RECENT_AUTH_REQUIRED") {
													setRecentAuthAction("export");
													return;
												}
												addToast({ title: "Export unavailable", description: "Please retry or contact support.", color: "danger" });
											}
										}}
									>
										<IconDatabase />
										Export Account Data
									</Button>
									<Button fullWidth onPress={deleteModalOnOpen} variant='danger'>
										{<IconTrash />}
										Schedule Account Deletion
									</Button>
									<span className='text-sm text-muted'>Account deletion keeps your resources recoverable for 30 days before permanent erasure. Losing Pro is separate: existing resources remain, but paid capabilities and changes beyond Free limits are restricted.</span>
								</div>
							</div>
						</Card.Content>
					</Card>
				)}
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

			<UpgradeModal
				key={`${upgradeMode}-${upgradeIntent.source}-${upgradeIntent.feature}-${upgradeIntent.cycle}`}
				isOpen={upgradeModalIsOpen}
				onOpenChange={upgradeModalOnOpenChange}
				user={user}
				title={upgradeMode === "runner_addon" ? (user.entitlements?.effectivePlan === "pro" ? "Add the Runner add-on" : "Upgrade with Runner") : "Upgrade Account"}
				source={upgradeIntent.source}
				feature={upgradeMode === "runner_addon" ? "runner_access" : upgradeIntent.feature}
				initialBillingCycle={upgradeIntent.cycle}
				mode={upgradeMode}
			/>

			<ConfirmModal
				isOpen={deleteModalIsOpen}
				onOpenChange={deleteModalOnOpenChange}
				keyword={user.username}
				title='Schedule account deletion'
				confirmLabel={deletionChoice === "paid_through" ? "Schedule deletion" : "Delete after confirmation"}
				content={
					<div className='space-y-4'>
						<p className='text-sm'>Choose when dashboard, overlay, and integration suspension begins. Stripe remains responsible for billing lifecycle messages; Clipify sends recovery and data-deletion reminders.</p>
						<div className='grid gap-2'>
							<Button variant={deletionChoice === "paid_through" ? "primary" : "secondary"} onPress={() => setDeletionChoice("paid_through")}>
								After paid access ends (recommended)
							</Button>
							<p className='text-xs text-muted'>Renewal stops and suspension starts on the paid-through date. If there is no paid period, suspension starts now.</p>
							<Button variant={deletionChoice === "immediate" ? "danger" : "secondary"} onPress={() => setDeletionChoice("immediate")}>
								Suspend now
							</Button>
							<p className='text-xs text-muted'>Sessions are revoked immediately. Billing ends under the displayed cancellation and refund policy; resources remain recoverable for 30 days.</p>
						</div>
					</div>
				}
				onConfirm={async () => {
					addToast({
						title: "Scheduling deletion...",
						description: "Clipify is recording your choice and recovery window.",
						color: "warning",
					});
					try {
						const result = await requestAccountDeletion(deletionChoice);
						if (result.status === "suspended") {
							router.push("/login?returnUrl=%2Fdashboard%2Fsettings%2Faccount%2Frecovery");
							return;
						}
						deleteModalOnOpenChange(false);
						addToast({ title: "Deletion scheduled", description: `Access remains available until ${new Date(result.suspensionAt).toLocaleString()}.`, color: "success" });
					} catch (error) {
						if (error instanceof Error && error.message === "RECENT_AUTH_REQUIRED") {
							deleteModalOnOpenChange(false);
							setRecentAuthAction("deletion");
							return;
						}
						addToast({ title: "Deletion was not scheduled", description: "Please retry or contact support.", color: "danger" });
					}
				}}
			/>

			<ControlledModal variant='blur' isOpen={recentAuthAction !== null} onClose={() => setRecentAuthAction(null)}>
				<Modal.Header>
					<Modal.Heading>Confirm it&apos;s you</Modal.Heading>
				</Modal.Header>
				<Modal.Body>
					<p className='text-sm text-foreground'>For sensitive account actions, Clipify requires a Twitch identity check completed within the last five minutes. You do not need to sign out.</p>
				</Modal.Body>
				<Modal.Footer>
					<Button variant='tertiary' onPress={() => setRecentAuthAction(null)} isDisabled={isReauthenticating}>
						Cancel
					</Button>
					<Button variant='primary' onPress={() => void reauthenticateWithTwitch()} isPending={isReauthenticating}>
						<IconBrandTwitch aria-hidden='true' />
						Verify with Twitch
					</Button>
				</Modal.Footer>
			</ControlledModal>
		</>
	);
}
