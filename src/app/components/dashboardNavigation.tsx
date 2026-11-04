"use client";
import { createContext, useContext, useSyncExternalStore } from "react";
import { Breadcrumbs, Button } from "@heroui/react";
import { IconMenu2 } from "@tabler/icons-react";
const subscribeToHydration = () => () => undefined;
const clientReady = () => true;
const serverReady = () => false;
export const DashboardNavigationContext = createContext<{ toggle: () => void; search: () => void; expanded: boolean; mobile?: boolean; current?: { href: string; title: string; detail: boolean; detailLabel?: string }; registerSearch: (node: HTMLButtonElement | null) => void } | null>(null);
export function DashboardNavigationControls() {
	const hydrated = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
	const context = useContext(DashboardNavigationContext);
	if (!context) return null;
	const mobileViewport = hydrated && window.innerWidth <= 768;
	const navigationReady = hydrated && Boolean(context.mobile) === mobileViewport;
	return (
		<div className='flex shrink-0 items-center'>
			<Button isDisabled={!navigationReady} isIconOnly variant='secondary' aria-label='Toggle navigation' aria-expanded={context.expanded} onPress={context.toggle}>
				<IconMenu2 className='size-5' />
			</Button>
		</div>
	);
}

export function DashboardBreadcrumbs() {
	const context = useContext(DashboardNavigationContext);
	if (!context || context.current?.href === "/dashboard") return null;
	const tourTargets: Record<string, string> = { "/dashboard/overlays": "overlays-tab", "/dashboard/playlists": "playlists-tab", "/dashboard/galleries": "galleries-tab", "/dashboard/runners": "runners-tab" };
	const tourTarget = context.mobile && !context.current?.detail ? tourTargets[context.current?.href ?? ""] : undefined;
	return (
		<Breadcrumbs aria-label='Dashboard breadcrumb' className='min-w-0'>
			<Breadcrumbs.Item href='/dashboard'>
				<span data-tour={context.mobile ? "dashboard-home" : undefined}>Home</span>
			</Breadcrumbs.Item>
			{context.current && context.current.href !== "/dashboard" ? (
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
