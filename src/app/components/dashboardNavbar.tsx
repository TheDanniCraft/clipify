"use client";

import { IconBuildingCommunity, IconCheck, IconDiamondFilled, IconMoonFilled, IconSunFilled } from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { Button, ComboBox, Dropdown, Input, Label, Link, ListBox, Spinner } from "@heroui/react";

import { AuthenticatedUser, CampaignOffer, Role } from "@types";
import Logo from "@components/logo";
import CountdownTimer from "@components/countdownTimer";
import DashboardUserAvatar from "@components/dashboardUserAvatar";
import { useRouter } from "next/navigation";
import { getAdminViewCandidates, stopAdminView, switchAdminView, type AdminViewCandidate } from "@actions/adminView";
import { getActiveCampaignOfferAction } from "@actions/campaignOffers";
import { useEffect, useMemo, useState } from "react";
import { authClient } from "@/auth/client";

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
	const { theme, setTheme } = useTheme();
	const router = useRouter();
	const session = authClient.useSession();
	const organizations = authClient.useListOrganizations();
	const [isClearingAdminView, setIsClearingAdminView] = useState(false);
	const [isSwitchingAdminView, setIsSwitchingAdminView] = useState(false);
	const [switchQuery, setSwitchQuery] = useState(user?.username ?? "");
	const [switchCandidates, setSwitchCandidates] = useState<AdminViewCandidate[]>([]);
	const [isLoadingSwitchCandidates, setIsLoadingSwitchCandidates] = useState(false);
	const [switchError, setSwitchError] = useState<string | null>(null);
	const [campaignOffer, setCampaignOffer] = useState<CampaignOffer | null>(null);
	const effectivePlan = user?.entitlements?.effectivePlan ?? user?.plan;
	const showUpgradeItem = user?.plan === "free" && (effectivePlan === "free" || Boolean(user?.entitlements?.reverseTrialActive));
	const isImpersonating = Boolean(user?.adminView?.active);
	const canOpenAdminView = user?.role === Role.Admin || isImpersonating;
	const organizationOptions = useMemo(() => (organizations.data ?? []) as OrganizationOption[], [organizations.data]);
	const sessionOrganizationId = session.data?.session.activeOrganizationId ?? null;
	const activeOrganizationId = organizationId ?? sessionOrganizationId;
	const activeOrganization = organizationOptions.find((organization) => organization.id === activeOrganizationId);

	useEffect(() => {
		if (!organizationId || !session.data || organizations.isPending || sessionOrganizationId === organizationId || !organizationOptions.some((organization) => organization.id === organizationId)) return;
		void authClient.organization.setActive({ organizationId }).then((result) => {
			if (!result.error) router.refresh();
		});
	}, [organizationId, organizationOptions, organizations.isPending, router, session.data, sessionOrganizationId]);

	async function switchAccount(organization: OrganizationOption) {
		if (organization.id === sessionOrganizationId) return;
		const result = await authClient.organization.setActive({ organizationId: organization.id });
		if (result.error) return;
		router.push(accountType(organization) === "agency" ? "/dashboard/agency" : "/dashboard");
		router.refresh();
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
		setSwitchError(null);
		try {
			const result = await switchAdminView(targetUserId);
			if (!result.ok) {
				setSwitchError(`Switch failed: ${result.error}`);
				return;
			}
			router.push("/dashboard");
			router.refresh();
		} finally {
			setIsSwitchingAdminView(false);
		}
	}

	return (
		<>
			<nav className='w-full bg-accent'>
				<header className='mx-auto flex h-16 w-full max-w-5xl items-center px-4 lg:px-8'>
					<Link href='/dashboard' className='flex items-center'>
						<Logo width={30} />
						<p className='ml-2 font-bold text-white'>Clipify</p>
					</Link>
					<ul className='ml-auto flex h-12 max-w-fit items-center gap-0'>
						{organizationOptions.length > 1 ? (
							<li className='mr-1'>
								<Dropdown>
									<Dropdown.Trigger aria-label='Switch account' className='button button--md button--ghost max-w-44 text-accent-foreground'>
										<IconBuildingCommunity aria-hidden='true' size={18} />
										<span className='truncate'>{activeOrganization?.name ?? "Switch account"}</span>
									</Dropdown.Trigger>
									<Dropdown.Popover placement='bottom end'>
										<Dropdown.Menu aria-label='Account context'>
											{organizationOptions.map((organization) => (
												<Dropdown.Item key={organization.id} id={organization.id} textValue={organization.name} onAction={() => void switchAccount(organization)}>
													<div className='flex min-w-52 items-center justify-between gap-4'>
														<div>
															<Label>{organization.name}</Label>
															<p className='text-xs capitalize text-muted'>{accountType(organization)} account</p>
														</div>
														{organization.id === activeOrganizationId ? <IconCheck aria-label='Active account' size={16} /> : null}
													</div>
												</Dropdown.Item>
											))}
										</Dropdown.Menu>
									</Dropdown.Popover>
								</Dropdown>
							</li>
						) : null}
						<li>
							<Button isIconOnly variant='ghost' onPress={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label='Toggle Theme'>
								{(theme ?? "dark") === "dark" ? <IconSunFilled className='text-accent-foreground/60' width={24} /> : <IconMoonFilled className='text-accent-foreground/60' width={24} />}
							</Button>
						</li>
						<li className='px-2'>
							<Dropdown>
								<Dropdown.Trigger className='mt-1 h-8 w-8 overflow-visible transition-transform' aria-label='Open profile menu'>
									<DashboardUserAvatar username={user?.username ?? "User"} avatar={user?.avatar ?? ""} showStatus />
								</Dropdown.Trigger>
								<Dropdown.Popover placement='bottom end'>
									<Dropdown.Menu aria-label='Profile Actions' disabledKeys={isClearingAdminView ? ["exit_admin_view"] : []}>
										<Dropdown.Item id='profile' textValue={`Signed in as ${user?.username ?? "user"}`} className='h-14 gap-2'>
											<Label>
												<span className='block font-semibold'>Signed in as</span>
												<span className='block font-semibold'>{user?.username}</span>
											</Label>
										</Dropdown.Item>
										{showUpgradeItem ? (
											<Dropdown.Item id='upgrade_to_pro' textValue='Upgrade to Pro' className='bg-accent text-accent-foreground data-[hovered]:bg-accent-hover' onAction={() => router.push("/dashboard/settings?upgrade&cycle=yearly&source=paywall_banner&feature=account_menu")}>
												<IconDiamondFilled aria-hidden='true' size={16} />
												<Label>Upgrade to Pro</Label>
											</Dropdown.Item>
										) : null}
										<Dropdown.Item id='settings' textValue={user.plan ? "My Settings" : "Agency dashboard"} onAction={() => router.push(user.plan ? "/dashboard/settings" : "/dashboard/agency")}>
											<Label>{user.plan ? "My Settings" : "Agency dashboard"}</Label>
										</Dropdown.Item>
										<Dropdown.Item id='member_card' textValue='Badges' onAction={() => router.push("/dashboard/member-card")}>
											<Label>Badges</Label>
										</Dropdown.Item>
										<Dropdown.Item id='embeddable_widgets' textValue='Tools' onAction={() => router.push("/dashboard/tools")}>
											<Label>Tools</Label>
										</Dropdown.Item>
										{canOpenAdminView ? (
											<Dropdown.Item id='admin_view' textValue='Open Admin View' onAction={() => router.push("/admin")}>
												<Label>Open Admin View</Label>
											</Dropdown.Item>
										) : null}
										{isImpersonating ? (
											<Dropdown.Item id='exit_admin_view' textValue='Exit Admin View' className='text-accent' onAction={handleExitAdminView}>
												<Label>Exit Admin View</Label>
											</Dropdown.Item>
										) : null}
										<Dropdown.Item id='help_and_feedback' textValue='Help' onAction={() => router.push("https://help.clipify.us/")}>
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
								className='min-w-[380px]'
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
						{switchError ? <p className='text-[11px] text-danger'>{switchError}</p> : null}
					</div>
				</div>
			) : null}
			<div className='w-full'>
				<main className='mt-6 flex w-full flex-col items-center'>
					<div className='w-full max-w-5xl px-4 lg:px-8'>
						<header className=' flex w-full items-center justify-between'>
							<div className='flex flex-col'>
								<h1 className='text-xl font-bold text-foreground lg:text-3xl'>{title}</h1>
								<p className='text-sm text-muted lg:text-base'>{tagline}</p>
							</div>
						</header>
						{children}
					</div>
				</main>
			</div>
		</>
	);
}
