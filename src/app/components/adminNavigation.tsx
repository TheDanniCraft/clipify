"use client";
import { Sidebar } from "@heroui-pro/react";
import { usePathname } from "next/navigation";
import { IconBuildingBank, IconLayoutDashboard } from "@tabler/icons-react";
export default function AdminNavigation() {
	const path = usePathname();
	return (
		<Sidebar.Group className='border-t border-separator pt-2 mt-2'>
			<Sidebar.GroupLabel>Admin</Sidebar.GroupLabel>
			<Sidebar.Menu aria-label='Admin sections'>
				{[
					{ href: "/admin", title: "Operations", icon: IconLayoutDashboard },
					{ href: "/admin/agencies", title: "Agencies", icon: IconBuildingBank },
				].map((item) => (
					<Sidebar.MenuItem key={item.href} id={item.href} href={item.href} isCurrent={path === item.href} textValue={item.title} render={(props) => <div {...props} />}>
						<Sidebar.MenuIcon>
							<item.icon className='size-4' />
						</Sidebar.MenuIcon>
						<Sidebar.MenuLabel>{item.title}</Sidebar.MenuLabel>
					</Sidebar.MenuItem>
				))}
			</Sidebar.Menu>
		</Sidebar.Group>
	);
}
