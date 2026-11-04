"use client";
import NextLink from "next/link";

import { IconBuildingCommunity, IconDiamondFilled, IconMoonFilled, IconSunFilled } from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { Autocomplete, Button, ComboBox, Dropdown, EmptyState, Input, Label, ListBox, SearchField, Spinner, useFilter } from "@heroui/react";

import { AuthenticatedUser, CampaignOffer, Role } from "@types";
import DashboardUtilityPortal from "@components/dashboardUtilityPortal";
import Logo from "@components/logo";
import { notify } from "@lib/toast";
import { DashboardNavigationContext, DashboardNavigationControls, DashboardBreadcrumbs } from "@components/dashboardNavigation";
import CountdownTimer from "@components/countdownTimer";
import DashboardUserAvatar from "@components/dashboardUserAvatar";
import { useRouter } from "next/navigation";
import { getAdminViewCandidates, stopAdminView, switchAdminView, type AdminViewCandidate } from "@actions/adminView";
import { getActiveCampaignOfferAction } from "@actions/campaignOffers";
import { Fragment, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { authClient } from "@/auth/client";

const subscribeToHydration = () => () => undefined;
const clientReady = () => true;
const serverReady = () => false;

export type DashboardNavbarUser = Pick<AuthenticatedUser, "id" | "username"> & Partial<Pick<AuthenticatedUser, "avatar" | "role" | "plan" | "entitlements" | "adminView">>;

type OrganizationOption = { id: string; name: string; metadata?: unknown };

function accountType(organization: OrganizationOption) {
	let metadata = organization.metadata;
	if (typeof metadata === "string") {
		try {
			metadata = JSON.parse(metadata || "{}");
		} catch {
			metadata = {};
		}
	}
	return metadata && typeof metadata === "object" && "accountType" in metadata && metadata.accountType === "agency" ? "agency" : "creator";
}

export default function DashboardNavbar({ children, user, title, tagline, organizationId }: { children?: React.ReactNode; user: DashboardNavbarUser; title: string; tagline: string; organizationId?: string }) {
	const navigation = useContext(DashboardNavigationContext);
	const inShell = navigation !== null;
	const AccountControlsContainer = inShell ? DashboardUtilityPortal : Fragment;
	const ContentContainer = inShell ? "div" : "main";
	const { theme, setTheme } = useTheme();
	const hydrated = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
	const { contains } = useFilter({ sensitivity: "base" });
	const router = useRouter();
	const session = authClient.useSession();
	const organizations = authClient.useListOrganizations();
	const [isClearingAdminView, setIsClearingAdminView] = useState(false);
	const [isSwitchingAdminView, setIsSwitchingAdminView] = useState(false);
	const [switchQuery, setSwitchQuery] = useState(user?.username ?? "");
	const [switchCandidates, setSwitchCandidates] = useState<AdminViewCandidate[]>([]);
	const [isLoadingSwitchCandidates, setIsLoadingSwitchCandidates] = useState(false);
	const [isSwitchingOrganization, setIsSwitchingOrganization] = useState(false);
	const appliedOrganization = useRef<string | null>(null);
	const [campaignOffer, setCampaignOffer] = useState<CampaignOffer | null>(null);
	const effectivePlan = user?.entitlements?.effectivePlan ?? user?.plan;
	const showUpgradeItem = user?.plan === "free" && (effectivePlan === "free" || Boolean(user?.entitlements?.reverseTrialActive));
	const isImpersonating = Boolean(user?.adminView?.active);
	const canOpenAdminView = user?.role === Role.Admin && !isImpersonating;
	const signedInUsername = isImpersonating ? (user.adminView?.adminUsername ?? "admin") : (user?.username ?? "user");
	const signedInAvatar = isImpersonating ? (user.adminView?.adminAvatar ?? "") : (user?.avatar ?? "");
	const organizationOptions = useMemo(() => (organizations.data ?? []) as OrganizationOption[], [organizations.data]);
	const sessionOrganizationId = session.data?.session.activeOrganizationId ?? null;
	const activeOrganizationId = organizationId ?? sessionOrganizationId;
	const activeOrganization = organizationOptions.find((organization) => organization.id === activeOrganizationId);
	const displayedOrganization = activeOrganization ?? organizationOptions.find((organization) => accountType(organization) === "creator") ?? organizationOptions[0];

	useEffect(() => {
		if (!organizationId) {
			appliedOrganization.current = null;
			return;
		}
		if (!session.data || organizations.isPending || appliedOrganization.current === organizationId || !organizationOptions.some((organization) => organization.id === organizationId)) return;
		// Apply each route's account request once; a later user switch takes precedence.
		appliedOrganization.current = organizationId;
		if (sessionOrganizationId === organizationId) return;
		void authClient.organization.setActive({ organizationId }).then((result) => {
			if (result.error) appliedOrganization.current = null;
			else router.refresh();
		});
	}, [organizationId, organizationOptions, organizations.isPending, router, session.data, sessionOrganizationId]);

	async function switchAccount(organization: OrganizationOption) {
		if (organization.id === sessionOrganizationId || isSwitchingOrganization) return;
		setIsSwitchingOrganization(true);
		try {
			const result = await authClient.organization.setActive({ organizationId: organization.id });
			if (result.error) return;
			router.push(accountType(organization) === "agency" ? "/dashboard/agency" : "/dashboard");
			router.refresh();
		} finally {
			setIsSwitchingOrganization(false);
		}
	}

	useEffect(() => {
		if (!isImpersonating) return;

		let cancelled = false;
		const timeout = setTimeout(async () => {
			setIsLoadingSwitchCandidates(true);
			try {
				const next = await getAdminViewCandidates(switchQuery);
				if (cancelled) return;
				setSwitchCandidates(next);
			} finally {
				if (!cancelled) setIsLoadingSwitchCandidates(false);
			}
		}, 180);

		return () => {
			cancelled = true;
			clearTimeout(timeout);
		};
	}, [isImpersonating, switchQuery]);

	const switchOptions = useMemo(() => {
		const map = new Map<string, AdminViewCandidate>();
		for (const candidate of switchCandidates) {
			if (candidate.id === user.id) continue;
			map.set(candidate.id, candidate);
		}
		return Array.from(map.values());
	}, [switchCandidates, user.id]);

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			try {
				const offer = await getActiveCampaignOfferAction();
				if (!cancelled) setCampaignOffer((offer as CampaignOffer | null) ?? null);
			} catch {
				if (!cancelled) setCampaignOffer(null);
			}
		};

		if (showUpgradeItem) {
			void load();
		}

		return () => {
			cancelled = true;
		};
	}, [showUpgradeItem]);

	useEffect(() => {
		if (!isImpersonating) return;
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setSwitchQuery(user.username);
	}, [isImpersonating, user.username]);

	async function handleExitAdminView() {
		if (isClearingAdminView) return;
		setIsClearingAdminView(true);
		try {
			await stopAdminView();
			router.push("/dashboard");
			router.refresh();
		} finally {
			setIsClearingAdminView(false);
		}
	}

	async function handleSwitchAdminView(targetUserId: string) {
		if (isSwitchingAdminView || !targetUserId) return;
		setIsSwitchingAdminView(true);
		try {
			const result = await switchAdminView(targetUserId);
			if (!result.ok) {
				notify({ title: "Account could not be switched", description: result.error, color: "danger" });
				return;
			}
			router.push("/dashboard");
			router.refresh();
		} finally {
			setIsSwitchingAdminView(false);
		}
	}

	const themeControl = (
		<Button isDisabled={!hydrated} isIconOnly variant='ghost' onPress={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label='Toggle Theme'>
			{!hydrated || theme !== "light" ? <IconSunFilled className={inShell ? "text-muted" : "text-accent-foreground/60"} width={24} /> : <IconMoonFilled className={inShell ? "text-muted" : "text-accent-foreground/60"} width={24} />}
		</Button>
	);

	return (
		<>
			<nav className={inShell ? "sticky top-0 z-30 w-full border-b border-separator bg-background" : "sticky top-0 z-30 w-full bg-accent"}>
				<header className='flex min-h-16 w-full items-center gap-3 px-4 py-2 lg:px-8'>
					<NextLink data-tour={inShell ? undefined : "dashboard-home"} href='/dashboard' className={inShell ? "hidden" : "flex items-center"}>
						<Logo width={30} />
						<p className='ml-2 font-bold text-white'>Clipify</p>
					</NextLink>
					<DashboardNavigationControls />
					{inShell ? <div className='min-w-0 flex-1'>{!navigation?.current || navigation.current.href === "/dashboard" ? <span className='text-sm font-medium'>{navigation?.current?.title ?? title}</span> : <DashboardBreadcrumbs />}</div> : null}
					{inShell ? themeControl : null}
					<AccountControlsContainer {...(inShell ? { slot: "account" as const } : {})}>
						<ul data-dashboard-account-controls className={inShell ? "flex w-full flex-wrap items-center gap-2" : "order-2 ml-auto flex h-12 max-w-fit items-center gap-0 sm:order-3"}>
							{organizationOptions.length > 1 ? (
								<li className={inShell ? "w-full" : "mr-1 w-36 sm:w-48"}>
									<Autocomplete
										aria-label='Account context'
										isDisabled={organizations.isPending || isSwitchingOrganization}
										placeholder='Select account'
										selectionMode='single'
										value={displayedOrganization?.id ?? null}
										variant='secondary'
										onChange={(key) => {
											const organization = organizationOptions.find((candidate) => candidate.id === String(key ?? ""));
											if (organization) void switchAccount(organization);
										}}
									>
										<Label className='sr-only'>Account</Label>
										<Autocomplete.Trigger className='h-9 items-center gap-2 rounded-xl border-transparent bg-default px-2 text-foreground shadow-none hover:bg-default-hover'>
											<span className='flex h-5 w-4 shrink-0 items-center justify-center text-muted'>
												<IconBuildingCommunity aria-hidden='true' className='translate-y-px' size={15} />
											</span>
											<Autocomplete.Value className='block min-w-0 flex-1 truncate text-left text-sm font-medium leading-5'>{displayedOrganization?.name ?? "Select account"}</Autocomplete.Value>
											<Autocomplete.Indicator className='shrink-0 text-muted' />
										</Autocomplete.Trigger>
										<Autocomplete.Popover className='min-w-64' placement='bottom end'>
											<Autocomplete.Filter filter={contains}>
												<SearchField autoFocus aria-label='Search accounts' name='account-search' variant='secondary'>
													<SearchField.Group>
														<SearchField.SearchIcon />
														<SearchField.Input placeholder='Search accounts' />
														<SearchField.ClearButton />
													</SearchField.Group>
												</SearchField>
												<ListBox renderEmptyState={() => <EmptyState>No accounts found.</EmptyState>}>
													{organizationOptions.map((organization) => (
														<ListBox.Item key={organization.id} id={organization.id} textValue={organization.name}>
															<div className='min-w-0'>
																<Label className='block truncate'>{organization.name}</Label>
																<p className='text-xs capitalize text-muted'>{accountType(organization)} account</p>
															</div>
															<ListBox.ItemIndicator />
														</ListBox.Item>
													))}
												</ListBox>
											</Autocomplete.Filter>
										</Autocomplete.Popover>
									</Autocomplete>
								</li>
							) : null}
							{!inShell ? <li>{themeControl}</li> : null}
							<li className={inShell ? "min-w-0 flex-1" : "px-2"}>
								<Dropdown>
									<Dropdown.Trigger data-tour='nav-menu' className={inShell ? "flex h-10 w-full min-w-0 items-center gap-2 rounded-lg px-2 text-foreground" : "mt-1 h-8 w-8 overflow-visible transition-transform"} aria-label='Open profile menu'>
										<DashboardUserAvatar username={signedInUsername} avatar={signedInAvatar} showStatus />
										{inShell ? <span className='truncate text-sm font-medium'>{signedInUsername}</span> : null}
									</Dropdown.Trigger>
									<Dropdown.Popover placement='bottom end'>
										<Dropdown.Menu aria-label='Profile Actions' disabledKeys={isClearingAdminView ? ["exit_admin_view"] : []}>
											<Dropdown.Item id='profile' textValue={`Signed in as ${signedInUsername}`} className={isImpersonating ? "h-20 gap-2" : "h-14 gap-2"}>
												<Label>
													<span className='block font-semibold'>Signed in as</span>
													<span className='block font-semibold'>{signedInUsername}</span>
													{isImpersonating ? <span className='mt-1 block text-xs font-normal text-muted'>Viewing as {user.username}</span> : null}
												</Label>
											</Dropdown.Item>
											{showUpgradeItem ? (
												<Dropdown.Item id='upgrade_to_pro' textValue='Upgrade to Pro' className='bg-accent text-accent-foreground data-[hovered]:bg-accent-hover' onAction={() => router.push("/dashboard/settings?upgrade&cycle=yearly&source=paywall_banner&feature=account_menu")}>
													<IconDiamondFilled aria-hidden='true' size={16} />
													<Label>Upgrade to Pro</Label>
												</Dropdown.Item>
											) : null}
											<Dropdown.Item data-tour='nav-settings' id='settings' textValue={user.plan ? "My Settings" : "Agency dashboard"} onAction={() => router.push(user.plan ? "/dashboard/settings" : "/dashboard/agency")}>
												<Label>{user.plan ? "My Settings" : "Agency dashboard"}</Label>
											</Dropdown.Item>
											<Dropdown.Item id='member_card' textValue='Badges' onAction={() => router.push("/dashboard/member-card")}>
												<Label>Badges</Label>
											</Dropdown.Item>
											<Dropdown.Item data-tour='nav-tools' id='embeddable_widgets' textValue='Tools' onAction={() => router.push("/dashboard/tools")}>
												<Label>Tools</Label>
											</Dropdown.Item>
											{canOpenAdminView ? (
												<Dropdown.Item id='admin_view' textValue='Open Admin View' onAction={() => router.push("/admin")}>
													<Label>Open Admin View</Label>
												</Dropdown.Item>
											) : null}
											{isImpersonating ? (
												<Dropdown.Item id='exit_admin_view' textValue='Return to Admin' className='text-accent' onAction={handleExitAdminView}>
													<Label>Return to Admin</Label>
												</Dropdown.Item>
											) : null}
											<Dropdown.Item id='help_and_feedback' textValue='Help' onAction={() => router.push("https://help.clipify.us/hc/clipify/articles/1769328012-getting-started-with-clipify")}>
												<Label>Help</Label>
											</Dropdown.Item>
											<Dropdown.Item id='logout' textValue='Log Out' variant='danger' onAction={() => router.push("/logout")}>
												<Label>Log Out</Label>
											</Dropdown.Item>
										</Dropdown.Menu>
									</Dropdown.Popover>
								</Dropdown>
							</li>
						</ul>
					</AccountControlsContainer>
				</header>
			</nav>
			{showUpgradeItem && campaignOffer?.showDashboardBanner ? (
				<div className='w-full border-b border-default bg-surface/95'>
					<div className='mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-8'>
						<div className='min-w-0'>
							<p className='text-xs font-semibold uppercase tracking-[0.2em] text-accent'>{campaignOffer.badgeText ?? campaignOffer.title}</p>
							<p className='truncate text-sm text-muted'>{campaignOffer.floatingSubtitle ?? "Upgrade today with the active campaign price."}</p>
						</div>
						<div className='flex items-center gap-3 self-start lg:self-auto'>
							{campaignOffer.endAt ? <CountdownTimer endAt={campaignOffer.endAt} tone='light' size='sm' showSeconds className='scale-90 origin-right' /> : null}
							<Button size='sm' onPress={() => router.push("/dashboard/settings?upgrade&cycle=yearly&source=paywall_banner&feature=active_campaign")} variant='primary'>
								Upgrade Today
							</Button>
						</div>
					</div>
				</div>
			) : null}
			{isImpersonating ? (
				<div className='w-full bg-surface/95'>
					<div className='mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-2 lg:flex-row lg:items-center lg:justify-between lg:px-8'>
						<p className='text-xs text-foreground dark:text-muted'>
							You are viewing as <span className='font-semibold'>@{user.username}</span>
						</p>
						<div className='flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto'>
							<ComboBox
								allowsEmptyCollection
								allowsCustomValue
								aria-label='Search and select user for admin view'
								className='w-full min-w-0 sm:min-w-[380px]'
								inputValue={switchQuery}
								isDisabled={isSwitchingAdminView}
								onInputChange={setSwitchQuery}
								onSelectionChange={(key) => {
									const nextKey = String(key ?? "");
									if (!nextKey) return;
									const selected = switchOptions.find((candidate) => candidate.id === nextKey);
									if (selected) setSwitchQuery(selected.username);
									void handleSwitchAdminView(nextKey);
								}}
							>
								<Label className='sr-only'>Search users</Label>
								<ComboBox.InputGroup>
									<Input placeholder='Search users' />
									<ComboBox.Trigger />
								</ComboBox.InputGroup>
								<ComboBox.Popover>
									<ListBox
										items={switchOptions}
										renderEmptyState={() => {
											if (switchQuery.length === 0) return <div className='p-4 text-center text-sm text-muted'>Type to search...</div>;
											if (isLoadingSwitchCandidates)
												return (
													<div className='flex items-center justify-center p-4'>
														<Spinner size='sm' color='current' />
													</div>
												);
											if (switchQuery.length < 3) return <div className='p-4 text-center text-sm text-muted'>Keep typing...</div>;
											return <div className='p-4 text-center text-sm text-muted'>No users found.</div>;
										}}
									>
										{(candidate) => (
											<ListBox.Item id={candidate.id} textValue={candidate.username}>
												<Label>@{candidate.username}</Label>
												<ListBox.ItemIndicator />
											</ListBox.Item>
										)}
									</ListBox>
								</ComboBox.Popover>
							</ComboBox>
							<Button size='sm' variant='danger-soft' onPress={handleExitAdminView} isDisabled={isClearingAdminView}>
								Exit
							</Button>
						</div>
					</div>
				</div>
			) : null}
			<div className='w-full'>
				<ContentContainer className='mt-6 flex w-full flex-col items-center'>
					<div className='mx-auto w-full min-w-0 max-w-7xl px-4 pb-8 lg:px-8'>
						<header className='flex w-full min-w-0 items-start justify-between gap-4'>
							<div className='flex min-w-0 flex-col gap-1'>
								<h1 className='text-xl font-bold text-foreground lg:text-3xl'>{title}</h1>
								<p className='text-sm text-muted lg:text-base'>{tagline}</p>
							</div>
						</header>
						{children}
					</div>
				</ContentContainer>
			</div>
		</>
	);
}
