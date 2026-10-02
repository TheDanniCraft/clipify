import Link from "next/link";
import { IconBuildingBank, IconLayoutDashboard } from "@tabler/icons-react";

const items = [
	{ href: "/admin", label: "Operations", icon: IconLayoutDashboard },
	{ href: "/admin/agencies", label: "Agencies", icon: IconBuildingBank },
] as const;

export default function AdminNavigation({ active }: { active: "operations" | "agencies" }) {
	return (
		<nav aria-label='Admin sections' className='flex flex-wrap gap-2 rounded-2xl border border-default bg-surface p-2'>
			{items.map(({ href, label, icon: Icon }) => {
				const selected = (active === "operations" && href === "/admin") || (active === "agencies" && href === "/admin/agencies");
				return (
					<Link key={href} href={href} aria-current={selected ? "page" : undefined} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${selected ? "bg-accent text-accent-foreground" : "text-muted hover:bg-surface-secondary hover:text-foreground"}`}>
						<Icon aria-hidden='true' size={18} />
						{label}
					</Link>
				);
			})}
		</nav>
	);
}
