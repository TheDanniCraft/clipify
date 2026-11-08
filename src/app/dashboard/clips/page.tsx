import { redirect } from "next/navigation";
import { validateAuth } from "@actions/auth";
import { getCreatorClipInventory } from "@actions/creatorLibrary";
import DashboardNavbar from "@components/dashboardNavbar";
import ClipInventory from "@components/creator/clipInventory";

export default async function ClipsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
	const user = await validateAuth();
	if (!user) redirect("/logout");
	const params = await searchParams;
	const raw = Object.fromEntries(Object.entries(params).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
	const query: Record<string, unknown> = { ...raw };
	for (const key of ["page", "pageSize", "minViews", "minDuration", "maxDuration"]) if (raw[key] !== undefined) query[key] = Number(raw[key]);
	const data = await getCreatorClipInventory({ creatorId: user.id, query });
	return (
		<DashboardNavbar user={user} title='Clip Inventory' tagline='Find, preview and export your clips'>
			<ClipInventory key={user.id} creatorId={user.id} query={raw} data={data} />
		</DashboardNavbar>
	);
}
