"use client";

import { IconMoonFilled, IconSunFilled } from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { Autocomplete, AutocompleteItem, Avatar, Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Link, Spacer } from "@heroui/react";

import { AuthenticatedUser, CampaignOffer, Role } from "@types";
import Logo from "@components/logo";
import CountdownTimer from "@components/countdownTimer";
import { useRouter } from "next/navigation";
import { getAdminViewCandidates, stopAdminView, switchAdminView, type AdminViewCandidate } from "@actions/adminView";
import { getActiveCampaignOfferAction } from "@actions/campaignOffers";
import { useEffect, useMemo, useState } from "react";

export default function DashboardNavbar({ children, user, title, tagline }: { children: React.ReactNode; user: AuthenticatedUser; title: string; tagline: string }) {
	const { theme, setTheme } = useTheme();
	const router = useRouter();
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
			<nav className='w-full bg-primary'>
				<header className='flex h-16 w-full items-center px-4 sm:px-6'>
					<Link href='/dashboard' className='flex items-center'>
						<Logo width={30} />
						<Spacer x={2} />
						<p className='font-bold text-white'>Clipify</p>
					</Link>
					<ul className='ml-auto flex h-12 max-w-fit items-center gap-0'>
					<li>
						<Button isIconOnly variant='tertiary' onPress={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label='Toggle Theme' className='rounded-full'>
							{(theme ?? "dark") === "dark" ? <IconSunFilled className='text-primary-foreground/60' width={24} /> : <IconMoonFilled className='text-primary-foreground/60' width={24} />}
						</Button>
					</li>
					<li className='px-2'>
						<Dropdown placement='bottom-end'>
							<DropdownTrigger>
								<button className='relative mt-1 h-8 w-8 transition-transform' aria-label='Open profile menu'>
									<Avatar size='sm'>
										<Avatar.Image alt={user?.username ?? "User avatar"} src={user?.avatar} />
										<Avatar.Fallback>{user?.username?.slice(0, 2).toUpperCase() ?? "?"}</Avatar.Fallback>
									</Avatar>
									<span aria-label='Online' className='absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-primary bg-success' role='status' />
								</button>
							</DropdownTrigger>
							<DropdownMenu aria-label='Profile Actions' variant='flat'>
								<DropdownItem key='profile' className='h-14 gap-2'>
									<p className='font-semibold'>Signed in as</p>
									<p className='font-semibold'>{user?.username}</p>
								</DropdownItem>
								{showUpgradeItem ? (
									<DropdownItem key='upgrade_to_pro' className='text-primary' onPress={() => router.push("/dashboard/settings?upgrade&cycle=yearly&source=paywall_banner&feature=account_menu")}>
										Upgrade to Pro
									</DropdownItem>
								) : null}
								<DropdownItem key='settings' onPress={() => router.push("/dashboard/settings")}>
									My Settings
								</DropdownItem>
								<DropdownItem key='embeddable_widgets' onPress={() => router.push("/dashboard/embed")}>
									Embed Overlay
								</DropdownItem>
								{canOpenAdminView ? (
									<DropdownItem key='admin_view' onPress={() => router.push("/admin")}>
										Open Admin View
									</DropdownItem>
								) : null}
								{isImpersonating ? (
									<DropdownItem key='exit_admin_view' className='text-primary' isDisabled={isClearingAdminView} onPress={handleExitAdminView}>
										Exit Admin View
									</DropdownItem>
								) : null}
								<DropdownItem key='help_and_feedback' onPress={() => router.push("https://help.clipify.us/")}>
									Help
								</DropdownItem>
								<DropdownItem key='Refer_a_friend' onPress={() => router.push("/referral-program")}>
									Refer a Friend
								</DropdownItem>
								<DropdownItem className='text-danger' key='logout' onPress={() => router.push("/logout")}>
									Log Out
								</DropdownItem>
							</DropdownMenu>
						</Dropdown>
					</li>
					</ul>
				</header>
			</nav>
			{showUpgradeItem && campaignOffer?.showDashboardBanner ? (
				<div className='w-full border-b border-default-200 bg-content1/95'>
					<div className='mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-8'>
						<div className='min-w-0'>
							<p className='text-xs font-semibold uppercase tracking-[0.2em] text-primary'>{campaignOffer.badgeText ?? campaignOffer.title}</p>
							<p className='truncate text-sm text-default-600'>{campaignOffer.floatingSubtitle ?? "Upgrade today with the active campaign price."}</p>
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
				<div className='w-full bg-content1/95'>
					<div className='mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-2 lg:flex-row lg:items-center lg:justify-between lg:px-8'>
						<p className='text-xs text-default-700 dark:text-default-300'>
							You are viewing as <span className='font-semibold'>@{user.username}</span>
						</p>
						<div className='flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto'>
							<Autocomplete
								size='sm'
								aria-label='Search and select user for admin view'
								placeholder='Search users'
								className='min-w-[380px]'
								inputValue={switchQuery}
								isLoading={isLoadingSwitchCandidates}
								isDisabled={isSwitchingAdminView}
								variant='bordered'
								color='default'
								radius='md'
								defaultItems={switchOptions}
								onInputChange={setSwitchQuery}
								onSelectionChange={(key) => {
									const nextKey = String(key ?? "");
									if (!nextKey) return;
									const selected = switchOptions.find((candidate) => candidate.id === nextKey);
									if (selected) setSwitchQuery(selected.username);
									void handleSwitchAdminView(nextKey);
								}}
							>
								{(candidate) => (
									<AutocompleteItem key={candidate.id} textValue={candidate.username}>
										@{candidate.username}
									</AutocompleteItem>
								)}
							</Autocomplete>
							<Button size='sm' variant='danger-soft' onPress={handleExitAdminView} isDisabled={isClearingAdminView} className='rounded-md'>
								Exit
							</Button>
						</div>
						{switchError ? <p className='text-[11px] text-danger-600'>{switchError}</p> : null}
					</div>
				</div>
			) : null}
			<div className='w-full'>
				<main className='mt-6 flex w-full flex-col items-center'>
					<div className='w-full max-w-5xl px-4 lg:px-8'>
						<header className=' flex w-full items-center justify-between'>
							<div className='flex flex-col'>
								<h1 className='text-xl font-bold text-default-900 lg:text-3xl'>{title}</h1>
								<p className='text-small text-default-400 lg:text-medium'>{tagline}</p>
							</div>
						</header>
						{children}
					</div>
				</main>
			</div>
		</>
	);
}
