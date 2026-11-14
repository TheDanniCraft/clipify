import ResourceLoadError from "@components/resourceLoadError";
import { Link } from "@heroui/react";
import { redirect } from "next/navigation";
import { getCreatorBrand } from "@actions/creatorBrand";
import { validateAuth } from "@actions/auth";
import DashboardNavbar from "@components/dashboardNavbar";
import ClipLayoutLibrary from "@components/creator/clipLayoutLibrary";
export default async function ClipLayoutsPage({ searchParams }: { searchParams: Promise<{ layout?: string; clip?: string; reference?: string; new?: string; format?: string }> }) {
	const user = await validateAuth();
	if (!user) redirect("/logout");
	const params = await searchParams;
	const brand = await getCreatorBrand(user.id);
	const id = (value: unknown) => (typeof value === "string" && /^[a-zA-Z0-9_-]{1,200}$/.test(value) ? value : undefined);
	return (
		<DashboardNavbar stickyHeading user={user} title='Clip layouts' tagline='Reusable Desktop and Mobile compositions'>
			{brand.ok ? (
				<ClipLayoutLibrary user={user} brand={brand.brand} canRemoveWatermark={brand.canRemoveWatermark} key={user.id} creatorId={user.id} layoutId={id(params.layout)} clipId={id(params.clip)} referenceId={id(params.reference)} newFormat={params.new} outputFormat={params.format} />
			) : (
				<ResourceLoadError message='Brand styling could not be loaded. Your layouts are preserved.'>
					<Link href='/dashboard/clip-layouts'>Retry layouts</Link>
				</ResourceLoadError>
			)}
		</DashboardNavbar>
	);
}
