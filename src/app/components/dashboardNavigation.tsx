"use client";
import { createContext, useContext, useSyncExternalStore } from "react";
import { Breadcrumbs, Button } from "@heroui/react";
import { IconMenu2, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from "@tabler/icons-react";
const subscribeToHydration = () => () => undefined;
const clientReady = () => true;
const serverReady = () => false;
export const DashboardNavigationContext = createContext<{ toggle: () => void; search: () => void; expanded: boolean; mobile?: boolean; homeHref?: string; current?: { href: string; title: string; detail: boolean; detailLabel?: string }; registerSearch: (node: HTMLButtonElement | null) => void } | null>(null);
export function DashboardNavigationControls() {
	const hydrated = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
	const context = useContext(DashboardNavigationContext);
	if (!context) return null;
	const mobileViewport = hydrated && window.innerWidth <= 768;
	const navigationReady = hydrated && Boolean(context.mobile) === mobileViewport;
	return (
		<div className='flex shrink-0 items-center'>
			<Button isDisabled={!navigationReady} isIconOnly variant={context.mobile ? "secondary" : "ghost"} className='text-muted' aria-label='Toggle navigation' aria-expanded={context.expanded} onPress={context.toggle}>
				{context.mobile ? <IconMenu2 className='size-5' /> : context.expanded ? <IconLayoutSidebarLeftCollapse className='size-5' /> : <IconLayoutSidebarLeftExpand className='size-5' />}
			</Button>
		</div>
	);
}

export function DashboardBreadcrumbs() {
	const context = useContext(DashboardNavigationContext);
	if (!context) return null;
	const homeHref = context.homeHref ?? "/dashboard";
	if (context.current?.href === homeHref && !context.current.detail) return null;
	const tourTargets: Record<string, string> = { "/dashboard/overlays": "overlays-tab", "/dashboard/playlists": "playlists-tab", "/dashboard/galleries": "galleries-tab", "/dashboard/runners": "runners-tab" };
	const tourTarget = context.mobile && !context.current?.detail ? tourTargets[context.current?.href ?? ""] : undefined;
	return (
		<Breadcrumbs aria-label='Dashboard breadcrumb' className='min-w-0'>
			<Breadcrumbs.Item href={homeHref}>
				<span data-tour={context.mobile ? "dashboard-home" : undefined}>{homeHref === "/dashboard/agency" ? "Agency" : "Home"}</span>
			</Breadcrumbs.Item>
			{context.current && context.current.href !== homeHref ? (
				<Breadcrumbs.Item href={context.current.detail ? context.current.href : undefined}>
					<span data-tour={tourTarget} aria-current={tourTarget ? "page" : undefined}>
						{context.current.title}
					</span>
				</Breadcrumbs.Item>
			) : null}
			{context.current?.detail ? <Breadcrumbs.Item>{context.current.detailLabel ?? (context.current.href === "/dashboard/streams" ? "Stream" : "Editor")}</Breadcrumbs.Item> : null}
		</Breadcrumbs>
	);
}
