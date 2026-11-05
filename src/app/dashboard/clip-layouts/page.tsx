import { redirect } from "next/navigation";
import { validateAuth } from "@actions/auth";
import DashboardNavbar from "@components/dashboardNavbar";
import ClipLayoutLibrary from "@components/creator/clipLayoutLibrary";
export default async function ClipLayoutsPage({ searchParams }: { searchParams: Promise<{ layout?: string; clip?: string; reference?: string; new?: string }> }) {
	const user = await validateAuth();
	if (!user) redirect("/logout");
	const params = await searchParams;
	const id = (value: unknown) => (typeof value === "string" && /^[a-zA-Z0-9_-]{1,200}$/.test(value) ? value : undefined);
	return (
		<DashboardNavbar user={user} title='Clip layouts' tagline='Reusable Desktop and Mobile compositions'>
			<ClipLayoutLibrary key={user.id} creatorId={user.id} layoutId={id(params.layout)} clipId={id(params.clip)} referenceId={id(params.reference)} newFormat={params.new} />
		</DashboardNavbar>
	);
}
