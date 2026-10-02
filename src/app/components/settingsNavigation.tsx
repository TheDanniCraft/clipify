"use client";

import { Tabs } from "@heroui/react";
import { useRouter } from "next/navigation";

export type SettingsNavigationKey = "settings" | "creator" | "billing" | "security" | "team" | "roles" | "agencies";

const ROUTES: Record<Exclude<SettingsNavigationKey, "settings" | "creator" | "billing">, string> = {
	security: "/dashboard/settings/security",
	team: "/dashboard/settings/team",
	roles: "/dashboard/settings/roles",
	agencies: "/dashboard/settings/agencies",
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
				<Tabs.List aria-label='Settings sections' className='min-w-max'>
					<Tabs.Tab id='settings'>
						Settings
						<Tabs.Indicator />
					</Tabs.Tab>
					<Tabs.Tab id='creator'>
						Creator Page
						<Tabs.Indicator />
					</Tabs.Tab>
					<Tabs.Tab id='billing'>
						Billing
						<Tabs.Indicator />
					</Tabs.Tab>
					<Tabs.Tab id='security'>
						Sign-in &amp; security
						<Tabs.Indicator />
					</Tabs.Tab>
					<Tabs.Tab id='team'>
						Team
						<Tabs.Indicator />
					</Tabs.Tab>
					<Tabs.Tab id='roles'>
						Roles
						<Tabs.Indicator />
					</Tabs.Tab>
					<Tabs.Tab id='agencies'>
						Agency access
						<Tabs.Indicator />
					</Tabs.Tab>
				</Tabs.List>
			</Tabs.ListContainer>
		</Tabs>
	);
}
