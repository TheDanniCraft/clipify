"use client";

import { Tabs } from "@heroui/react";
import { IconBuildingBank, IconLayoutDashboard } from "@tabler/icons-react";
import { useRouter } from "next/navigation";

const items = [
	{ id: "operations", href: "/admin", label: "Operations", icon: IconLayoutDashboard },
	{ id: "agencies", href: "/admin/agencies", label: "Agencies", icon: IconBuildingBank },
] as const;

export default function AdminNavigation({ active }: { active: "operations" | "agencies" }) {
	const router = useRouter();

	return (
		<Tabs selectedKey={active} onSelectionChange={(key) => router.push(items.find((item) => item.id === String(key))?.href ?? "/admin")} className='w-full' variant='primary'>
			<Tabs.ListContainer className='w-full overflow-x-auto'>
				<Tabs.List aria-label='Admin sections' className='w-full min-w-[20rem]'>
					{items.map(({ id, label, icon: Icon }) => (
						<Tabs.Tab key={id} id={id} className='flex-1'>
							<Icon aria-hidden='true' size={17} />
							{label}
							<Tabs.Indicator />
						</Tabs.Tab>
					))}
				</Tabs.List>
			</Tabs.ListContainer>
		</Tabs>
	);
}
