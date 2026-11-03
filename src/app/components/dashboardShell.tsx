"use client";
import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar, Command, useSidebar } from "@heroui-pro/react";
import { Button } from "@heroui/react";
import { IconHome, IconVideo, IconScissors, IconLayoutGrid, IconPlaylist, IconPhoto, IconDeviceDesktop, IconTools, IconSettings, IconFolder, IconSearch, IconHelpCircle } from "@tabler/icons-react";
import NextLink from "next/link";
import Logo from "./logo";
import ClipPreview from "./creator/clipPreview";
import { searchCreatorLibrary } from "@actions/creatorLibrary";
import { DashboardNavigationContext } from "./dashboardNavigation";
import { isEmbeddedRoute } from "@lib/embeddedRoutes";
import type { Permission } from "@/auth/permissions";
const destinations = [
	{ title: "Home", href: "/dashboard", permission: "creator:read", icon: IconHome },
	{ title: "Streams", href: "/dashboard/streams", permission: "creator:read", icon: IconVideo },
	{ title: "Clip Inventory", href: "/dashboard/clips", permission: "creator:read", icon: IconScissors },
	{ title: "Overlays", href: "/dashboard/overlays", permission: "overlay:read", icon: IconLayoutGrid, tour: "overlays-tab" },
	{ title: "Playlists", href: "/dashboard/playlists", permission: "playlist:read", icon: IconPlaylist, tour: "playlists-tab" },
	{ title: "Galleries", href: "/dashboard/galleries", permission: "gallery:read", icon: IconPhoto, tour: "galleries-tab" },
	{ title: "Runner", href: "/dashboard/runners", permission: "runner:read", icon: IconDeviceDesktop, tour: "runners-tab" },
	{ title: "Tools", href: "/dashboard/tools", permission: null, icon: IconTools },
	{ title: "Settings", href: "/dashboard/settings", permission: "account:read", icon: IconSettings },
] as const;
type SearchClip = Extract<Awaited<ReturnType<typeof searchCreatorLibrary>>, { ok: true }>["items"][number];
function NavigationFrame({ children, creatorId, permissions, open, setOpen }: { children: ReactNode; creatorId: string; permissions: Permission[]; open: boolean; setOpen: (open: boolean) => void }) {
	const router = useRouter();
	const path = usePathname();
	const sidebar = useSidebar();
	const [searchOpen, setSearchOpen] = useState(false);
	const [preview, setPreview] = useState<SearchClip | null>(null);
	const [waitingForDrawer, setWaitingForDrawer] = useState(false);
	const [query, setQuery] = useState("");
	const [clips, setClips] = useState<SearchClip[]>([]);
	const [searchError, setSearchError] = useState(false);
	const [retry, setRetry] = useState(0);
	const [searching, setSearching] = useState(false);
	const searchRef = useRef<HTMLButtonElement | null>(null);
	const allowed = destinations.filter((item) => item.permission === null || permissions.includes(item.permission));
	let active = path;
	if (path.startsWith("/dashboard/overlay/")) active = "/dashboard/overlays";
	if (path.startsWith("/dashboard/playlist/")) active = "/dashboard/playlists";
	if (path.startsWith("/dashboard/runner/")) active = "/dashboard/runners";
	const current = allowed.find((item) => active === item.href || (item.href !== "/dashboard" && active.startsWith(item.href + "/")));
	const toggle = () => (sidebar.isMobile ? sidebar.setMobileOpen(!sidebar.isMobileOpen) : setOpen(!open));
	const showSearch = () => {
		setQuery("");
		setClips([]);
		setSearchError(false);
		if (sidebar.isMobileOpen) {
			sidebar.setMobileOpen(false);
			setWaitingForDrawer(true);
		} else setSearchOpen(true);
	};
	useEffect(() => {
		if (!waitingForDrawer || sidebar.isMobileOpen) return;
		const timer = setTimeout(() => {
			setWaitingForDrawer(false);
			setSearchOpen(true);
		}, 250);
		return () => clearTimeout(timer);
	}, [waitingForDrawer, sidebar.isMobileOpen]);
	useEffect(() => {
		if (!sidebar.isMobile) sidebar.setMobileOpen(false);
	}, [sidebar.isMobile, sidebar.setMobileOpen]);
	useEffect(() => {
		const handle = (event: KeyboardEvent) => {
			const target = event.target instanceof Element ? event.target : null;
			if (!(event.ctrlKey || event.metaKey) || target?.closest("input,textarea,select,[contenteditable=true]")) return;
			if (event.key.toLowerCase() === "k") {
				if (document.querySelector('[role="dialog"][aria-modal="true"]') && !sidebar.isMobileOpen) return;
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
		if (!searchOpen || query.trim().length < 2) return;
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
	}, [creatorId, query, searchOpen, retry]);
	const menuItem = (item: (typeof destinations)[number]) => (
		<Sidebar.MenuItem key={item.href} id={item.href} href={item.href} isCurrent={current?.href === item.href} render={(props) => <div {...props} aria-current={current?.href === item.href ? "page" : undefined} />} aria-current={current?.href === item.href ? "page" : undefined} textValue={item.title} data-tour={"tour" in item ? item.tour : undefined}>
			<Sidebar.MenuIcon>
				<item.icon className='size-4' />
			</Sidebar.MenuIcon>
			<Sidebar.MenuLabel>{item.title}</Sidebar.MenuLabel>
		</Sidebar.MenuItem>
	);
	const navigation = (
		<>
			<Sidebar.Header>
				<NextLink data-tour={sidebar.isMobile ? undefined : "dashboard-home"} href='/dashboard' aria-label='Clipify Home' className='flex h-12 items-center gap-2 px-1 font-bold text-foreground'>
					<Logo width={28} />
					{sidebar.isMobile || open ? <span>Clipify</span> : null}
				</NextLink>
				<Button ref={searchRef} variant='secondary' isIconOnly={!sidebar.isMobile && !open} className={sidebar.isMobile || open ? "w-full justify-start" : "w-full justify-center"} aria-label='Search clips and tools' aria-haspopup='dialog' onPress={showSearch}>
					<IconSearch className='size-4 shrink-0' />
					{sidebar.isMobile || open ? <span className='truncate'>Search clips and tools</span> : null}
				</Button>
			</Sidebar.Header>
			<Sidebar.Content>
				<Sidebar.Group>
					<Sidebar.Menu aria-label='Creator navigation' defaultExpandedKeys={["resources"]}>
						{allowed
							.slice(0, 3)
							.filter((item) => ["Home", "Streams", "Clip Inventory"].includes(item.title))
							.map(menuItem)}
						{allowed.some((item) => "tour" in item) ? (
							<Sidebar.MenuItem id='resources' textValue='Create and share'>
								<Sidebar.MenuIcon>
									<IconFolder className='size-4' />
								</Sidebar.MenuIcon>
								<Sidebar.MenuLabel>
									Create and share
									<Sidebar.MenuTrigger>
										<Sidebar.MenuIndicator />
									</Sidebar.MenuTrigger>
								</Sidebar.MenuLabel>
								<Sidebar.Submenu>{allowed.filter((item) => "tour" in item).map(menuItem)}</Sidebar.Submenu>
							</Sidebar.MenuItem>
						) : null}
						{allowed.filter((item) => item.title === "Tools" || item.title === "Settings").map(menuItem)}
					</Sidebar.Menu>
				</Sidebar.Group>
			</Sidebar.Content>
			{!sidebar.isMobile ? (
				<Sidebar.Footer>
					{!open ? (
						<Button isIconOnly variant='tertiary' aria-label='Show help and getting started' onPress={() => setOpen(true)}>
							<IconHelpCircle className='size-4' />
						</Button>
					) : null}
					<div id='dashboard-utilities' className={open ? "flex flex-col gap-2" : "hidden"} />
				</Sidebar.Footer>
			) : null}
		</>
	);
	const changeSearch = (open: boolean) => {
		setSearchOpen(open);
		if (!open) requestAnimationFrame(() => searchRef.current?.focus());
	};
	return (
		<DashboardNavigationContext.Provider
			value={{
				toggle,
				search: showSearch,
				expanded: sidebar.isMobile ? sidebar.isMobileOpen : open,
				mobile: sidebar.isMobile,
				current: current ? { href: current.href, title: current.title, detail: path !== current.href } : undefined,
				registerSearch: (node) => {
					searchRef.current = node;
				},
			}}
		>
			<Sidebar style={{ "--sidebar-width": "16rem", "--sidebar-width-collapsed": "3rem" } as CSSProperties}>{navigation}</Sidebar>
			<Sidebar.Mobile>{navigation}</Sidebar.Mobile>
			<Sidebar.Main className='min-w-0'>
				{children}
				{sidebar.isMobile ? <div id='dashboard-utilities' className='mt-auto flex flex-wrap items-center gap-3 border-t border-separator p-4' /> : null}
			</Sidebar.Main>
			<Command>
				<Command.Backdrop isOpen={searchOpen} onOpenChange={changeSearch}>
					<Command.Container size='lg'>
						<Command.Dialog
							aria-label='Search clips and tools'
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
									aria-label='Search clips and tools'
									placeholder='Search clips and tools…'
								/>
								<Command.InputGroup.ClearButton />
							</Command.InputGroup>
							<Command.List
								aria-label='Search results'
								renderEmptyState={() => <p className='p-4 text-sm text-muted'>{searching ? "Searching clips…" : "No matching clips or tools."}</p>}
								onAction={(key) => {
									const destination = allowed.find((item) => item.href === String(key));
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
										setPreview(clip);
									}
								}}
							>
								<Command.Group heading='Tools'>
									{allowed
										.filter((item) => item.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
										.map((item) => (
											<Command.Item key={item.href} id={item.href} textValue={item.title}>
												<item.icon className='size-4' />
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
								<p className='text-xs text-muted'>{query.trim().length < 2 ? "Type at least two characters to search clips." : searching ? "Searching clips…" : "Use arrow keys to choose a result and Enter to open it."}</p>
								<Button variant='tertiary' size='sm' onPress={() => changeSearch(false)}>
									Close search
								</Button>
							</Command.Footer>
						</Command.Dialog>
					</Command.Container>
				</Command.Backdrop>
			</Command>
			{preview ? (
				<ClipPreview
					key={`${creatorId}:${preview.id}`}
					creatorId={creatorId}
					clip={preview}
					onClose={() => {
						setPreview(null);
						requestAnimationFrame(() => searchRef.current?.focus());
					}}
				/>
			) : null}
		</DashboardNavigationContext.Provider>
	);
}
export default function DashboardShell({ children, creatorId, permissions }: { children: ReactNode; creatorId: string; permissions: Permission[] }) {
	const router = useRouter();
	const path = usePathname();
	const [open, setOpen] = useState(true);
	if (isEmbeddedRoute(path)) return children;
	return (
		<Sidebar.Provider open={open} onOpenChange={setOpen} navigate={router.push} toggleShortcut={false}>
			<NavigationFrame creatorId={creatorId} permissions={permissions} open={open} setOpen={setOpen}>
				{children}
			</NavigationFrame>
		</Sidebar.Provider>
	);
}
