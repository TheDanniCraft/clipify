"use client";

import { IconMoonFilled, IconSunFilled } from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { Avatar, Button, ComboBox, Dropdown, Input, Label, Link, ListBox } from "@heroui/react";

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
						<li>
							<Button isIconOnly variant='ghost' onPress={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label='Toggle Theme'>
								{(theme ?? "dark") === "dark" ? <IconSunFilled className='text-accent-foreground/60' width={24} /> : <IconMoonFilled className='text-accent-foreground/60' width={24} />}
							</Button>
						</li>
						<li className='px-2'>
							<Dropdown>
								<Dropdown.Trigger className='relative mt-1 h-8 w-8 overflow-visible transition-transform' aria-label='Open profile menu'>
									<Avatar size='sm'>
										<Avatar.Image alt={user?.username ?? "User avatar"} src={user?.avatar} />
										<Avatar.Fallback>{user?.username?.slice(0, 2).toUpperCase() ?? "?"}</Avatar.Fallback>
									</Avatar>
									<span aria-label='Online' className='absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-accent bg-success' role='status' />
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
											<Dropdown.Item id='upgrade_to_pro' textValue='Upgrade to Pro' className='text-accent' onAction={() => router.push("/dashboard/settings?upgrade&cycle=yearly&source=paywall_banner&feature=account_menu")}>
												<Label>Upgrade to Pro</Label>
											</Dropdown.Item>
										) : null}
										<Dropdown.Item id='settings' textValue='My Settings' onAction={() => router.push("/dashboard/settings")}>
											<Label>My Settings</Label>
										</Dropdown.Item>
										<Dropdown.Item id='embeddable_widgets' textValue='Embed Overlay' onAction={() => router.push("/dashboard/embed")}>
											<Label>Embed Overlay</Label>
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
										<Dropdown.Item id='refer_a_friend' textValue='Refer a Friend' onAction={() => router.push("/referral-program")}>
											<Label>Refer a Friend</Label>
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
									{isLoadingSwitchCandidates ? <span className='px-1 text-xs text-muted'>Loading</span> : null}
									<ComboBox.Trigger />
								</ComboBox.InputGroup>
								<ComboBox.Popover>
									<ListBox items={switchOptions}>
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
