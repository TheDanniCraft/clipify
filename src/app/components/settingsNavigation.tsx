"use client";

import { Tabs } from "@heroui/react";
import { useRouter } from "next/navigation";

export type SettingsNavigationKey = "settings" | "creator" | "billing" | "team";

const ROUTES: Record<Exclude<SettingsNavigationKey, "settings" | "creator" | "billing">, string> = {
	team: "/dashboard/settings/team",
};

export default function SettingsNavigation({ active, onCoreSectionChange }: { active: SettingsNavigationKey; onCoreSectionChange?: (section: "settings" | "creator" | "billing") => void }) {
	const router = useRouter();

	function navigate(key: React.Key) {
		const section = String(key) as SettingsNavigationKey;
		if (section === "settings" || section === "creator" || section === "billing") {
			if (onCoreSectionChange) {
				onCoreSectionChange(section);
				return;
			}
			router.push(section === "settings" ? "/dashboard/settings" : `/dashboard/settings?tab=${section}`);
			return;
		}
		router.push(ROUTES[section]);
	}

	return (
		<Tabs selectedKey={active} onSelectionChange={navigate} className='w-full' variant='primary'>
			<Tabs.ListContainer className='w-full overflow-x-auto'>
				<Tabs.List aria-label='Settings sections' className='w-full min-w-[32rem]'>
					<Tabs.Tab id='settings' className='flex-1'>
						Settings
						<Tabs.Indicator />
					</Tabs.Tab>
					<Tabs.Tab id='creator' className='flex-1'>
						Creator Page
						<Tabs.Indicator />
					</Tabs.Tab>
					<Tabs.Tab id='billing' className='flex-1'>
						Billing
						<Tabs.Indicator />
					</Tabs.Tab>
					<Tabs.Tab id='team' className='flex-1'>
						Team
						<Tabs.Indicator />
					</Tabs.Tab>
				</Tabs.List>
			</Tabs.ListContainer>
		</Tabs>
	);
}
