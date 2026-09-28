import { getAgencyOverviewAction, removeAgencyLicenseFormAction } from "@/app/actions/agency";

export const dynamic = "force-dynamic";

export default async function AgencyAllocationsPage() {
	const overview = await getAgencyOverviewAction();
	return (
		<main className='mx-auto flex w-full max-w-5xl flex-col gap-6 p-6'>
			<header>
				<p className='text-sm text-muted'>Agency</p>
				<h1 className='text-2xl font-semibold'>Creator seat allocations</h1>
				<p className='text-sm text-muted'>Removal gives the creator seven days of access and continues occupying the seat during grace. Creator data and creator-owned benefits are never deleted.</p>
			</header>
			<section className='rounded-xl border border-default p-5'>
				<p className='font-medium'>
					{overview.occupiedSeats} / {overview.account.creatorSeatLimit} seats occupied
				</p>
				<ul className='mt-3 divide-y divide-default'>
					{overview.allocations.map((allocation) => (
						<li key={allocation.id} className='flex items-center justify-between gap-4 py-3'>
							<span>
								{allocation.creatorId}
								<small className='block text-muted'>
									{allocation.status}
									{allocation.endsAt ? ` · ends ${allocation.endsAt.toLocaleString()}` : ""}
								</small>
							</span>
							{allocation.status === "active" ? (
								<form action={removeAgencyLicenseFormAction}>
									<input type='hidden' name='allocationId' value={allocation.id} />
									<button className='rounded-lg border border-danger px-3 py-2 text-danger'>Schedule removal</button>
								</form>
							) : null}
						</li>
					))}
				</ul>
			</section>
		</main>
	);
}
