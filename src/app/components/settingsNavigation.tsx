"use client";

import { Tabs } from "@heroui/react";
import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export type SettingsNavigationKey = "settings" | "connections" | "creator" | "billing" | "team";

export default function SettingsNavigation({ active, onCoreSectionChange, children }: { active: SettingsNavigationKey; onCoreSectionChange?: (section: SettingsNavigationKey) => void; children: ReactNode }) {
	const router = useRouter();
	const root = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const frame = requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" }));
		return () => cancelAnimationFrame(frame);
	}, [active]);

	function navigate(key: React.Key) {
		const section = String(key) as SettingsNavigationKey;
		if (onCoreSectionChange) {
			onCoreSectionChange(section);
			return;
		}
		router.push(section === "settings" ? "/dashboard/settings" : `/dashboard/settings?tab=${section}`);
	}

	return (
		<Tabs ref={root} selectedKey={active} onSelectionChange={navigate} className='w-full min-w-0' variant='primary'>
			<Tabs.ListContainer className='w-full'>
				<Tabs.List aria-label='Settings sections' className='min-w-full'>
					<Tabs.Tab data-tour='settings-core-tab' id='settings' className='w-auto shrink-0 whitespace-nowrap sm:flex-1'>
						Settings
						<Tabs.Indicator />
					</Tabs.Tab>
					<Tabs.Tab data-tour='settings-connections-tab' id='connections' className='w-auto shrink-0 whitespace-nowrap sm:flex-1'>
						Connections
						<Tabs.Indicator />
					</Tabs.Tab>
					<Tabs.Tab id='creator' className='w-auto shrink-0 whitespace-nowrap sm:flex-1'>
						Creator Page
						<Tabs.Indicator />
					</Tabs.Tab>
					<Tabs.Tab id='billing' className='w-auto shrink-0 whitespace-nowrap sm:flex-1'>
						Billing
						<Tabs.Indicator />
					</Tabs.Tab>
					<Tabs.Tab data-tour='settings-team-tab' id='team' className='w-auto shrink-0 whitespace-nowrap sm:flex-1'>
						Team
						<Tabs.Indicator />
					</Tabs.Tab>
				</Tabs.List>
			</Tabs.ListContainer>
			<Tabs.Panel id={active}>{children}</Tabs.Panel>
		</Tabs>
	);
}
