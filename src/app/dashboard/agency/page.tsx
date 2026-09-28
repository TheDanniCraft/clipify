import Link from "next/link";
import { allocateAgencyLicenseFormAction, getAgencyOverviewAction, proposeAgencyLinkFormAction } from "@/app/actions/agency";
import { PERMISSIONS } from "@/auth/permissions";

export const dynamic = "force-dynamic";

export default async function AgencyDashboardPage({ searchParams }: { searchParams: Promise<{ creator?: string | string[]; error?: string | string[]; allocated?: string | string[] }> }) {
	const params = await searchParams;
	const requestedCreator = params.creator;
	const overview = await getAgencyOverviewAction(typeof requestedCreator === "string" ? requestedCreator : undefined);
	const creatorContext = overview.creatorContext;
	return (
		<main className='mx-auto flex w-full max-w-6xl flex-col gap-6 p-6'>
			<header>
				<p className='text-sm text-muted'>Agency</p>
				<h1 className='text-2xl font-semibold'>Creator management</h1>
				{params.allocated === "1" ? <p className='rounded-lg border border-success p-3 text-success'>Creator license allocated.</p> : null}
				{typeof params.error === "string" ? <p className='rounded-lg border border-danger p-3 text-danger'>Allocation failed: {params.error}</p> : null}
				<p className='text-sm text-muted'>
					{overview.occupiedSeats} of {overview.account.creatorSeatLimit} creator seats occupied. Team members do not consume seats.
				</p>
				<div className='flex flex-wrap gap-4 text-sm'>
					<Link href='/dashboard/agency/allocations' className='text-accent underline'>
						Manage allocations
					</Link>
					<Link href={`/dashboard/settings/team?organization=${encodeURIComponent(overview.account.organizationId)}`} className='text-accent underline'>
						Manage agency staff
					</Link>
					<Link href={`/dashboard/settings/roles?organization=${encodeURIComponent(overview.account.organizationId)}`} className='text-accent underline'>
						Manage agency roles
					</Link>
				</div>
			</header>
			<section className='rounded-xl border border-default p-5'>
				<h2 className='font-semibold'>Active creator context</h2>
				<p className='mt-1 text-sm text-muted'>Choose a linked creator without adding agency staff as direct members of that creator account.</p>
				{creatorContext.options.length ? (
					<nav className='mt-3 flex flex-wrap gap-2' aria-label='Linked creator context'>
						{creatorContext.options.map((link) => (
							<Link key={link.id} href={`/dashboard/agency?creator=${encodeURIComponent(link.creatorOrganizationId)}`} aria-current={creatorContext.selected?.id === link.id ? "page" : undefined} className={`rounded-lg border px-3 py-2 text-sm ${creatorContext.selected?.id === link.id ? "border-accent text-accent" : "border-default"}`}>
								{link.creatorOrganizationId}
							</Link>
						))}
					</nav>
				) : (
					<p className='mt-3 text-sm text-muted'>No accepted creator links yet.</p>
				)}
			</section>
			<form action={proposeAgencyLinkFormAction} className='rounded-xl border border-default p-5'>
				<h2 className='font-semibold'>Request creator access</h2>
				<label className='mt-3 flex flex-col gap-1 text-sm'>
					Creator account ID
					<input required name='creatorOrganizationId' className='rounded-lg border border-default bg-surface px-3 py-2' />
				</label>
				<div className='mt-3 grid gap-2 md:grid-cols-2'>
					{PERMISSIONS.map((permission) => (
						<label key={permission} className='flex gap-2 text-sm'>
							<input type='checkbox' name='permission' value={permission} />
							{permission}
						</label>
					))}
				</div>
				<button className='mt-4 rounded-lg bg-accent px-4 py-2 font-medium text-white'>Send access request</button>
			</form>
			<section className='rounded-xl border border-default p-5'>
				<h2 className='font-semibold'>Linked creators</h2>
				<ul className='mt-3 divide-y divide-default'>
					{overview.links.map((link) => (
						<li key={link.id} className='py-3'>
							<div className='flex justify-between'>
								<span>{link.creatorOrganizationId}</span>
								<span>{link.status}</span>
							</div>
							{link.status === "accepted" && !overview.allocations.some((allocation) => allocation.linkId === link.id && ["active", "removal_scheduled"].includes(allocation.status)) ? (
								<form action={allocateAgencyLicenseFormAction} className='mt-2 flex gap-2'>
									<input type='hidden' name='linkId' value={link.id} />
									<input type='hidden' name='creatorOrganizationId' value={link.creatorOrganizationId} />
									<input required name='sourceReference' placeholder='Commercial allocation reference' className='flex-1 rounded-lg border border-default bg-surface px-3 py-2' />
									<button className='rounded-lg border border-default px-3 py-2'>Allocate Pro seat</button>
								</form>
							) : null}
						</li>
					))}
				</ul>
			</section>
		</main>
	);
}
