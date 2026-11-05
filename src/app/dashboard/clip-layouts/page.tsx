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
		<DashboardNavbar user={user} title='Clip layouts' tagline='Reusable Desktop and Mobile compositions'>
			{brand.ok ? (
				<ClipLayoutLibrary brand={brand.brand} watermark={!brand.canRemoveWatermark || (brand.brand?.watermark ?? true)} key={user.id} creatorId={user.id} layoutId={id(params.layout)} clipId={id(params.clip)} referenceId={id(params.reference)} newFormat={params.new} outputFormat={params.format} />
			) : (
				<div className='space-y-3'>
					<p className='text-sm text-muted'>Brand styling could not be loaded. Your layouts are preserved.</p>
					<Link href='/dashboard/clip-layouts'>Retry layouts</Link>
				</div>
			)}
		</DashboardNavbar>
	);
}
