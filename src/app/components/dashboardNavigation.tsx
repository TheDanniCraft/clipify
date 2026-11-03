"use client";
import { createContext, useContext } from "react";
import { Breadcrumbs, Button } from "@heroui/react";
import { IconMenu2, IconSearch } from "@tabler/icons-react";
export const DashboardNavigationContext = createContext<{ toggle: () => void; search: () => void; expanded: boolean; mobile?: boolean; current?: { href: string; title: string; detail: boolean }; registerSearch: (node: HTMLButtonElement | null) => void } | null>(null);
export function DashboardNavigationControls() {
	const context = useContext(DashboardNavigationContext);
	if (!context) return null;
	return (
		<div className='order-3 flex w-full min-w-0 items-center gap-2 sm:order-2 sm:ml-6 sm:w-auto sm:flex-1'>
			<Button isIconOnly variant='secondary' aria-label='Toggle navigation' aria-expanded={context.expanded} onPress={context.toggle}>
				<IconMenu2 className='size-5' />
			</Button>
			<Button ref={(node) => context.registerSearch(node)} variant='secondary' className='min-w-0 flex-1 justify-start sm:max-w-sm' aria-label='Search clips and tools' aria-haspopup='dialog' onPress={context.search}>
				<IconSearch className='size-4 shrink-0' />
				<span className='truncate'>Search clips and tools</span>
				<span className='ml-auto hidden text-xs text-muted lg:inline'>⌘ / Ctrl K</span>
			</Button>
		</div>
	);
}

export function DashboardBreadcrumbs() {
	const context = useContext(DashboardNavigationContext);
	if (!context) return null;
	const tourTargets: Record<string, string> = { "/dashboard/overlays": "overlays-tab", "/dashboard/playlists": "playlists-tab", "/dashboard/galleries": "galleries-tab", "/dashboard/runners": "runners-tab" };
	const tourTarget = context.mobile && !context.current?.detail ? tourTargets[context.current?.href ?? ""] : undefined;
	return (
		<Breadcrumbs aria-label='Dashboard breadcrumb' className='mb-4'>
			<Breadcrumbs.Item href='/dashboard'>Home</Breadcrumbs.Item>
			{context.current && context.current.href !== "/dashboard" ? (
				<Breadcrumbs.Item href={context.current.detail ? context.current.href : undefined}>
					<span data-tour={tourTarget} aria-current={tourTarget ? "page" : undefined}>
						{context.current.title}
					</span>
				</Breadcrumbs.Item>
			) : null}
			{context.current?.detail ? <Breadcrumbs.Item>Editor</Breadcrumbs.Item> : null}
		</Breadcrumbs>
	);
}
