"use client";

import { IconMoonFilled, IconSunFilled } from "@tabler/icons-react";
import { useTheme } from "next-themes";
import { Autocomplete, AutocompleteItem, Avatar, Badge, Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Link, Navbar, NavbarBrand, NavbarContent, NavbarItem, Spacer } from "@heroui/react";
import { AuthenticatedUser, Role } from "@types";
import Logo from "@components/logo";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { getAdminViewCandidates, stopAdminView, switchAdminView, type AdminViewCandidate } from "@actions/adminView";
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
			<Script src='https://tag.goadopt.io/injector.js?website_code=792b9b29-57f9-4d92-b5f1-313f94ddfacc' strategy='afterInteractive' />
			<Navbar
				classNames={{
					base: "bg-primary",
					wrapper: "px-4 sm:px-6",
					item: "data-[active=true]:text-primary",
				}}
				height='64px'
			>
				<NavbarBrand>
					<Link href='/dashboard'>
						<Logo width={30} />
						<Spacer x={2} />
						<p className='font-bold text-white'>Clipify</p>
					</Link>
				</NavbarBrand>
				<NavbarContent className='ml-auto h-12 max-w-fit items-center gap-0' justify='end'>
					<NavbarItem>
						<Button isIconOnly radius='full' variant='light' onPress={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label='Toggle Theme'>
							{(theme ?? "dark") === "dark" ? <IconSunFilled className='text-primary-foreground/60' width={24} /> : <IconMoonFilled className='text-primary-foreground/60' width={24} />}
						</Button>
					</NavbarItem>
					<NavbarItem className='px-2'>
						<Dropdown placement='bottom-end'>
							<DropdownTrigger>
								<button className='mt-1 h-8 w-8 transition-transform' aria-label='Open profile menu'>
									<Badge
										classNames={{
											badge: "border-primary",
										}}
										color='success'
										content=''
										placement='bottom-right'
										shape='circle'
									>
										<Avatar size='sm' src={user?.avatar} />
									</Badge>
								</button>
							</DropdownTrigger>
							<DropdownMenu aria-label='Profile Actions' variant='flat'>
								<DropdownItem key='profile' className='h-14 gap-2'>
									<p className='font-semibold'>Signed in as</p>
									<p className='font-semibold'>{user?.username}</p>
								</DropdownItem>
								{showUpgradeItem ? (
									<DropdownItem key='upgrade_to_pro' className='text-warning' onPress={() => router.push("/dashboard/settings?upgrade&cycle=yearly&source=paywall_banner&feature=account_menu")}>
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
					</NavbarItem>
				</NavbarContent>
			</Navbar>
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
							<Button size='sm' color='danger' variant='flat' radius='md' onPress={handleExitAdminView} isDisabled={isClearingAdminView}>
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
