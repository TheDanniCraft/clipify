import { getAdminAgenciesAction, provisionAgencyFormAction } from "@/app/actions/agency";

export const dynamic = "force-dynamic";

export default async function AdminAgenciesPage({ searchParams }: { searchParams: Promise<{ error?: string; created?: string }> }) {
	const [agencies, params] = await Promise.all([getAdminAgenciesAction(), searchParams]);
	return (
		<main className='mx-auto flex w-full max-w-5xl flex-col gap-6 p-6'>
			<header>
				<p className='text-sm text-muted'>Admin</p>
				<h1 className='text-2xl font-semibold'>Agency accounts</h1>
				<p className='text-sm text-muted'>Agency accounts are provisioned only after custom commercial terms are agreed. Human team members never consume creator seats.</p>
			</header>
			{params.error ? <p className='rounded-lg border border-danger p-3 text-danger'>Provisioning failed: {params.error}</p> : null}
			{params.created ? <p className='rounded-lg border border-success p-3 text-success'>Agency invitation created.</p> : null}
			<form action={provisionAgencyFormAction} className='grid gap-4 rounded-xl border border-default p-5 md:grid-cols-2'>
				<label className='flex flex-col gap-1 text-sm'>
					Agency name
					<input required name='name' className='rounded-lg border border-default bg-surface px-3 py-2' />
				</label>
				<label className='flex flex-col gap-1 text-sm'>
					First owner email
					<input required type='email' name='ownerEmail' className='rounded-lg border border-default bg-surface px-3 py-2' />
				</label>
				<label className='flex flex-col gap-1 text-sm'>
					Commercial reference
					<input name='commercialReference' className='rounded-lg border border-default bg-surface px-3 py-2' />
				</label>
				<label className='flex flex-col gap-1 text-sm'>
					Creator seats
					<input required min='0' type='number' name='creatorSeatLimit' className='rounded-lg border border-default bg-surface px-3 py-2' />
				</label>
				<button className='rounded-lg bg-accent px-4 py-2 font-medium text-white md:col-span-2' type='submit'>
					Provision and invite owner
				</button>
			</form>
			<section className='rounded-xl border border-default p-5'>
				<h2 className='font-semibold'>Provisioned agencies</h2>
				<ul className='mt-3 divide-y divide-default'>
					{agencies.map(({ account, name }) => (
						<li key={account.organizationId} className='flex justify-between gap-4 py-3'>
							<span>
								{name}
								<small className='block text-muted'>{account.commercialReference ?? "No commercial reference"}</small>
							</span>
							<span className='text-sm'>
								{account.status} · {account.creatorSeatLimit} seats
							</span>
						</li>
					))}
				</ul>
			</section>
		</main>
	);
}
