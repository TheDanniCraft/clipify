"use client";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type CSSProperties } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Sidebar, Command, useSidebar } from "@heroui-pro/react";
import { Button, Kbd, Link } from "@heroui/react";
import { IconBolt, IconPalette, IconHome, IconLayoutCollage, IconVideo, IconScissors, IconLayoutGrid, IconPlaylist, IconPhoto, IconDeviceDesktop, IconTools, IconSettings, IconFolder, IconSearch, IconHelpCircle, IconUserCircle, IconPlug, IconId, IconCreditCard, IconUsers, IconPlayerPlay, IconAward, IconBuildingCommunity } from "@tabler/icons-react";
import NextLink from "next/link";
import { ClipExportProvider, ExportQueueLauncher } from "./creator/clipExportQueue";
import AdminNavigation from "./adminNavigation";
import Logo from "./logo";
import { settingsSections, settingsSection, toolSections } from "@lib/dashboardSections";
import { searchCreatorLibrary } from "@actions/creatorLibrary";
import { DashboardNavigationContext } from "./dashboardNavigation";
import { isEmbeddedRoute } from "@lib/embeddedRoutes";
import type { Permission } from "@/auth/permissions";
type Destination = { title: string; href: string; permission: Permission | null; icon?: typeof IconHome; tour?: string };
const destinations: Destination[] = [
	{ title: "Home", href: "/dashboard", permission: "creator:read", icon: IconHome, tour: "dashboard-home" },
	{ title: "Streams", href: "/dashboard/streams", permission: "creator:read", icon: IconVideo, tour: "streams-tab" },
	{ title: "Clip Inventory", href: "/dashboard/clips", permission: "creator:read", icon: IconScissors, tour: "clips-tab" },
	{ title: "Overlays", href: "/dashboard/overlays", permission: "overlay:read", icon: IconLayoutGrid, tour: "overlays-tab" },
	{ title: "Playlists", href: "/dashboard/playlists", permission: "playlist:read", icon: IconPlaylist, tour: "playlists-tab" },
	{ title: "Galleries", href: "/dashboard/galleries", permission: "gallery:read", icon: IconPhoto, tour: "galleries-tab" },
	{ title: "Runner", href: "/dashboard/runners", permission: "runner:read", icon: IconDeviceDesktop, tour: "runners-tab" },
	{ title: "Clip layouts", href: "/dashboard/clip-layouts", permission: "creator:read", icon: IconLayoutCollage, tour: "clip-layouts-tab" },
	{ title: "Tools", href: "/dashboard/tools", permission: null, icon: IconTools },
	{ title: "Settings", href: "/dashboard/settings", permission: "account:read", icon: IconSettings },
];
type SearchClip = Extract<Awaited<ReturnType<typeof searchCreatorLibrary>>, { ok: true }>["items"][number];
function markUtilityHostReady(node: HTMLDivElement | null) {
	node?.setAttribute("data-dashboard-utilities-ready", "true");
}
function NavigationFrame({ children, creatorId, permissions, open, setOpen, isAdmin = false }: { children: ReactNode; creatorId: string; permissions: Permission[]; open: boolean; setOpen: (open: boolean) => void; isAdmin?: boolean }) {
	const router = useRouter();
	const path = usePathname();
	const params = useSearchParams();
	const section = settingsSection(params);
	const activeGroup = path.startsWith("/dashboard/settings") || path === "/dashboard/member-card" ? "settings" : path === "/dashboard/tools" ? "tools" : undefined;
	const commandKey = useSyncExternalStore(
		() => () => undefined,
		() => /Mac|iPhone|iPad/.test(navigator.platform),
		() => false,
	);
	const navigationKey = `${path}?${params}`;
	const { isMobile, isMobileOpen, setMobileOpen } = useSidebar();
	const [searchOpen, setSearchOpen] = useState(false);
	const [waitingForDrawer, setWaitingForDrawer] = useState(false);
	const [query, setQuery] = useState("");
	const [clips, setClips] = useState<SearchClip[]>([]);
	const [searchError, setSearchError] = useState(false);
	const [retry, setRetry] = useState(0);
	const [searching, setSearching] = useState(false);
	const searchRef = useRef<HTMLButtonElement | null>(null);
	const homeHref = permissions.length ? "/dashboard" : "/dashboard/agency";
	const canSearchClips = permissions.includes("creator:read");
	const searchLabel = canSearchClips ? "Search clips and tools" : "Search pages";
	const settingsIcons = { brand: IconPalette, settings: IconUserCircle, connections: IconPlug, creator: IconId, billing: IconCreditCard, team: IconUsers };
	const settingsItems: Destination[] = settingsSections.filter((item) => permissions.includes(item.permission)).map((item) => ({ ...item, icon: settingsIcons[item.key] }));
	if (permissions.includes("account:read")) settingsItems.push({ title: "Badges", href: "/dashboard/member-card", permission: "account:read", icon: IconAward });
	const toolItems: Destination[] = permissions.length ? toolSections.map((item) => ({ ...item, permission: null, icon: item.title === "Clip Player" ? IconPlayerPlay : IconPhoto, tour: item.title === "Clip Player" ? "nav-tools" : undefined })) : [];
	const allowed = [...(!permissions.length ? [{ title: "Agency", href: "/dashboard/agency", permission: null, icon: IconBuildingCommunity }] : []), ...destinations].filter((item) => (item.title === "Settings" ? settingsItems.length > 0 : item.title === "Tools" ? toolItems.length > 0 : item.permission === null || permissions.includes(item.permission)));
	const searchable = [...new Map([...settingsItems, ...toolItems, ...allowed].map((item) => [item.href, item])).values()];
	const resources = allowed.filter((item) => ["Overlays", "Playlists", "Galleries", "Runner", "Clip layouts"].includes(item.title));
	const currentChild = activeGroup === "settings" && path === "/dashboard/settings" ? settingsItems.find((item) => item.href === settingsSections.find((candidate) => candidate.key === section)?.href) : activeGroup === "tools" ? toolItems[params.get("tool") === "gallery" ? 1 : 0] : undefined;
	let active = path;
	if (path.startsWith("/dashboard/overlay/")) active = "/dashboard/overlays";
	if (path.startsWith("/dashboard/playlist/")) active = "/dashboard/playlists";
	if (path.startsWith("/dashboard/runner/")) active = "/dashboard/runners";
	const current = path === "/dashboard/member-card" ? { title: "Badges", href: "/dashboard/member-card", permission: null } : allowed.find((item) => active === item.href || (item.href !== "/dashboard" && active.startsWith(item.href + "/")));
	useEffect(() => {
		if (!isMobileOpen) return;
		const closeForUtility = (event: MouseEvent) => {
			if (event.target instanceof Element && event.target.closest("#dashboard-mobile-utilities button, [data-dashboard-launcher]") && !event.target.closest("[data-dashboard-account-controls]")) setMobileOpen(false);
		};
		// Widget portals bubble through their React owners, so observe their DOM event here.
		document.addEventListener("click", closeForUtility, true);
		return () => document.removeEventListener("click", closeForUtility, true);
	}, [isMobileOpen, setMobileOpen]);

	useEffect(() => {
		setMobileOpen(false);
	}, [navigationKey, setMobileOpen]);

	const toggle = () => (isMobile ? setMobileOpen(!isMobileOpen) : setOpen(!open));
	const showSearch = () => {
		setQuery("");
		setClips([]);
		setSearchError(false);
		if (isMobileOpen) {
			setMobileOpen(false);
			setWaitingForDrawer(true);
		} else setSearchOpen(true);
	};
	useEffect(() => {
		if (!waitingForDrawer || isMobileOpen) return;
		const timer = setTimeout(() => {
			setWaitingForDrawer(false);
			setSearchOpen(true);
		}, 250);
		return () => clearTimeout(timer);
	}, [waitingForDrawer, isMobileOpen]);
	useEffect(() => {
		if (!isMobile) setMobileOpen(false);
	}, [isMobile, setMobileOpen]);
	useEffect(() => {
		const handle = (event: KeyboardEvent) => {
			const target = event.target instanceof Element ? event.target : null;
			if (!(event.ctrlKey || event.metaKey) || target?.closest("input,textarea,select,[contenteditable=true]")) return;
			if (event.key.toLowerCase() === "k") {
				if (document.querySelector('[role="dialog"][aria-modal="true"]') && !isMobileOpen) return;
				event.preventDefault();
				showSearch();
			}
			if (event.key.toLowerCase() === "b") {
				event.preventDefault();
				toggle();
			}
		};
		document.addEventListener("keydown", handle);
		return () => document.removeEventListener("keydown", handle);
	});
	useEffect(() => {
		if (!searchOpen || !canSearchClips || query.trim().length < 2) return;
		let current = true;
		const timer = setTimeout(() => {
			setSearching(true);
			void searchCreatorLibrary({ creatorId, title: query })
				.then((result) => {
					if (!current) return;
					setClips(result.ok ? result.items : []);
					setSearchError(!result.ok);
				})
				.catch(() => {
					if (current) setSearchError(true);
				})
				.finally(() => {
					if (current) setSearching(false);
				});
		}, 200);
		return () => {
			current = false;
			clearTimeout(timer);
		};
	}, [creatorId, query, searchOpen, retry, canSearchClips]);
	const menuItem = (item: Destination) => (
		<Sidebar.MenuItem key={item.href} id={item.href} href={item.href} isCurrent={(currentChild?.href ?? current?.href) === item.href} render={(props) => <div {...props} aria-current={(currentChild?.href ?? current?.href) === item.href ? "page" : undefined} />} aria-current={(currentChild?.href ?? current?.href) === item.href ? "page" : undefined} textValue={item.title} data-tour={item.tour} data-guide-navigation>
			{item.icon ? (
				<Sidebar.MenuIcon>
					<item.icon className='size-4' />
				</Sidebar.MenuIcon>
			) : null}
			<Sidebar.MenuLabel>{item.title}</Sidebar.MenuLabel>
		</Sidebar.MenuItem>
	);
	const navigation = (
		<>
			<Sidebar.Header>
				<NextLink data-tour={isMobile ? undefined : "dashboard-home"} href={homeHref} aria-label='Clipify Home' className='flex h-12 items-center gap-2 px-1 font-bold text-foreground'>
					<Logo width={28} />
					{isMobile || open ? <span>Clipify</span> : null}
				</NextLink>
				<Button ref={searchRef} variant='secondary' isIconOnly={!isMobile && !open} className={isMobile || open ? "w-full justify-start text-muted" : "w-full justify-center text-muted"} aria-label={searchLabel} aria-haspopup='dialog' onPress={showSearch}>
					<IconSearch className='size-4 shrink-0' />
					{isMobile || open ? (
						<>
							<span className='min-w-0 flex-1 truncate text-left'>Search</span>
							<Kbd variant='light' className='text-muted' aria-hidden='true'>
								<Kbd.Abbr keyValue={commandKey ? "command" : "ctrl"} />
								<Kbd.Content>K</Kbd.Content>
							</Kbd>
						</>
					) : null}
				</Button>
			</Sidebar.Header>
			<Sidebar.Content>
				<Sidebar.Group>
					<Sidebar.Menu aria-label='Creator navigation' className='clipify-creator-navigation' key={activeGroup ?? "root"} defaultExpandedKeys={["resources", ...(activeGroup ? [activeGroup] : [])]}>
						{allowed.filter((item) => ["Home", "Streams", "Clip Inventory", "Agency"].includes(item.title)).map(menuItem)}
						{resources.length > 0 ? (
							<Sidebar.MenuItem id='resources' textValue='Create and share' data-tour='resources-group' data-guide-navigation>
								<Sidebar.MenuIcon>
									<IconFolder className='size-4' />
								</Sidebar.MenuIcon>
								<Sidebar.MenuLabel>Create and share</Sidebar.MenuLabel>
								<Sidebar.MenuTrigger>
									<Sidebar.MenuIndicator />
								</Sidebar.MenuTrigger>
								<Sidebar.Submenu>{resources.map(menuItem)}</Sidebar.Submenu>
							</Sidebar.MenuItem>
						) : null}
						{[
							{ id: "tools", title: "Tools", icon: IconTools, items: toolItems },
							{ id: "settings", title: "Settings", icon: IconSettings, items: settingsItems },
						]
							.filter((group) => group.items.length > 0)
							.map((group) => (
								<Sidebar.MenuItem key={group.id} id={group.id} textValue={group.title} data-tour={`${group.id}-group`} data-guide-navigation>
									<Sidebar.MenuIcon>
										<group.icon className='size-4' />
									</Sidebar.MenuIcon>
									<Sidebar.MenuLabel>{group.title}</Sidebar.MenuLabel>
									<Sidebar.MenuTrigger>
										<Sidebar.MenuIndicator />
									</Sidebar.MenuTrigger>
									<Sidebar.Submenu>
										{group.items.map(menuItem)}
										{group.id === "tools" && canSearchClips ? (
											<Sidebar.MenuItem id='automations' textValue='Automations, coming soon' isDisabled tooltip='Automations — coming soon'>
												<Sidebar.MenuIcon>
													<IconBolt className='size-4' />
												</Sidebar.MenuIcon>
												<Sidebar.MenuLabel>Automations</Sidebar.MenuLabel>
												<Sidebar.MenuChip>Coming soon</Sidebar.MenuChip>
											</Sidebar.MenuItem>
										) : null}
									</Sidebar.Submenu>
								</Sidebar.MenuItem>
							))}
					</Sidebar.Menu>
				</Sidebar.Group>
				{isAdmin ? <AdminNavigation /> : null}
			</Sidebar.Content>
			{isMobile ? <div ref={markUtilityHostReady} data-dashboard-consent className='max-h-[35dvh] shrink-0 overflow-y-auto' /> : null}
			{
				<Sidebar.Footer className='gap-1 max-h-[50dvh] overflow-y-auto'>
					{!open ? (
						<Button isIconOnly variant='tertiary' aria-label='Show help and getting started' onPress={() => setOpen(true)}>
							<IconHelpCircle className='size-4' />
						</Button>
					) : null}
					<div ref={markUtilityHostReady} id={isMobile ? "dashboard-mobile-utilities" : "dashboard-utilities"} className='flex flex-col gap-0.5'>
						{["admin", "guide", "exports", "chat", "help", "report", "account"].map((slot) => (
							<div key={slot} data-dashboard-utility={slot} className={open || isMobile || slot === "account" || slot === "exports" ? "min-w-0 empty:hidden" : "hidden"}>
								{slot === "exports" ? <ExportQueueLauncher compact={!open && !isMobile} /> : null}
								{slot === "help" ? (
									<Link href='https://help.clipify.us/hc/clipify' target='_blank' rel='noopener noreferrer' className='flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted hover:bg-default hover:text-foreground'>
										<IconHelpCircle aria-hidden='true' className='size-4 shrink-0' />
										Help center
									</Link>
								) : null}
							</div>
						))}
					</div>
				</Sidebar.Footer>
			}
		</>
	);
	const changeSearch = (open: boolean) => {
		setSearchOpen(open);
		if (!open) requestAnimationFrame(() => (isMobile ? document.querySelector<HTMLButtonElement>('[aria-label="Toggle navigation"]') : searchRef.current)?.focus());
	};
	return (
		<DashboardNavigationContext.Provider
			value={{
				homeHref,
				toggle,
				search: showSearch,
				expanded: isMobile ? isMobileOpen : open,
				mobile: isMobile,
				current: current
					? {
							href: current.href,
							title: current.title,
							detail: Boolean(currentChild) || path !== current.href,
							detailLabel: currentChild?.title ?? (path === "/dashboard/agency/allocations" ? "Allocations" : path === "/dashboard/clips/layout" ? "Portrait layout" : path.startsWith("/dashboard/clips/") ? "Clip" : undefined) ?? (current.href === "/dashboard/settings" ? (path.startsWith("/dashboard/settings/team") ? "Team" : path.startsWith("/dashboard/settings/agencies") ? "Agency access" : "Account recovery") : undefined),
						}
					: undefined,
				registerSearch: (node) => {
					searchRef.current = node;
				},
			}}
		>
			<Sidebar style={{ "--sidebar-width": "16rem", "--sidebar-width-collapsed": "3rem" } as CSSProperties}>{navigation}</Sidebar>
			<Sidebar.Mobile>{navigation}</Sidebar.Mobile>
			<Sidebar.Main className='min-w-0'>
				{children}
				{isMobile ? <div ref={markUtilityHostReady} id='dashboard-utilities' className='hidden' /> : null}
			</Sidebar.Main>
			<Command>
				<Command.Backdrop isOpen={searchOpen} onOpenChange={changeSearch}>
					<Command.Container size='lg'>
						<Command.Dialog
							aria-label={searchLabel}
							inputValue={query}
							onInputChange={(value) => {
								setQuery(value);
								setClips([]);
								setSearchError(false);
							}}
							filter={() => true}
						>
							<Command.InputGroup>
								<Command.InputGroup.Prefix>
									<IconSearch />
								</Command.InputGroup.Prefix>
								<Command.InputGroup.Input
									onKeyDownCapture={(event) => {
										if (event.key === "Escape") {
											event.preventDefault();
											event.stopPropagation();
											changeSearch(false);
										}
									}}
									aria-label={searchLabel}
									placeholder={`${searchLabel}…`}
								/>
								<Command.InputGroup.ClearButton />
							</Command.InputGroup>
							<Command.List
								aria-label='Search results'
								renderEmptyState={() => <p className='p-4 text-sm text-muted'>{searching ? "Searching clips…" : canSearchClips ? "No matching clips or tools." : "No matching pages."}</p>}
								onAction={(key) => {
									const destination = searchable.find((item) => item.href === String(key));
									if (destination) {
										changeSearch(false);
										router.push(destination.href);
										return;
									}
									if (String(key) === "retry") {
										setRetry((value) => value + 1);
										return;
									}
									const clip = clips.find((item) => `clip:${item.id}` === String(key));
									if (clip) {
										changeSearch(false);
										router.push(`/dashboard/clips/${encodeURIComponent(clip.id)}`);
									}
								}}
							>
								<Command.Group heading='Pages'>
									{searchable
										.filter((item) => item.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
										.map((item) => (
											<Command.Item key={item.href} id={item.href} textValue={item.title}>
												{item.icon ? <item.icon className='size-4' /> : null}
												<span>{item.title}</span>
											</Command.Item>
										))}
								</Command.Group>
								{clips.length ? (
									<Command.Group heading='Clips'>
										{clips.map((clip) => (
											<Command.Item key={clip.id} id={`clip:${clip.id}`} textValue={clip.title}>
												<IconScissors className='size-4' />
												<span>{clip.title || "Untitled clip"}</span>
											</Command.Item>
										))}
									</Command.Group>
								) : null}
								{searchError ? (
									<Command.Group heading='Clip search unavailable'>
										<Command.Item id='retry' textValue='Retry clip search'>
											Retry clip search
										</Command.Item>
									</Command.Group>
								) : null}
							</Command.List>
							<Command.Footer>
								<p className='text-xs text-muted'>{!canSearchClips ? "Choose a page with the arrow keys and press Enter." : query.trim().length < 2 ? "Type at least two characters to search clips." : searching ? "Searching clips…" : "Use arrow keys to choose a result and Enter to open it."}</p>
								<Button variant='tertiary' size='sm' onPress={() => changeSearch(false)}>
									Close search
								</Button>
							</Command.Footer>
						</Command.Dialog>
					</Command.Container>
				</Command.Backdrop>
			</Command>
		</DashboardNavigationContext.Provider>
	);
}
export default function DashboardShell({ children, creatorId, permissions, isAdmin = false }: { children: ReactNode; creatorId: string; permissions: Permission[]; isAdmin?: boolean }) {
	const router = useRouter();
	const path = usePathname();
	const [open, setOpen] = useState(true);
	if (isEmbeddedRoute(path)) return children;
	return (
		<Sidebar.Provider open={open} onOpenChange={setOpen} navigate={router.push} toggleShortcut={false}>
			<ClipExportProvider key={creatorId} creatorId={creatorId}>
				<NavigationFrame isAdmin={isAdmin} creatorId={creatorId} permissions={permissions} open={open} setOpen={setOpen}>
					{children}
				</NavigationFrame>
			</ClipExportProvider>
		</Sidebar.Provider>
	);
}
