import { acceptAgencyLinkFormAction, getCreatorAgencyLinksAction, revokeAgencyLinkFormAction } from "@/app/actions/agency";
import { PERMISSIONS } from "@/auth/permissions";

export const dynamic = "force-dynamic";

export default async function CreatorAgencySettingsPage() {
	const links = await getCreatorAgencyLinksAction();
	return (
		<main className='mx-auto flex w-full max-w-5xl flex-col gap-6 p-6'>
			<header>
				<p className='text-sm text-muted'>Settings</p>
				<h1 className='text-2xl font-semibold'>Agency access</h1>
				<p className='text-sm text-muted'>You remain the creator owner. An agency receives only the permissions you approve, and revocation takes effect on its next operation.</p>
			</header>
			{links.length === 0 ? <p className='rounded-xl border border-default p-5'>No agency has requested access.</p> : null}
			{links.map(({ link, agencyName }) => (
				<section key={link.id} className='rounded-xl border border-default p-5'>
					<div className='flex items-start justify-between gap-4'>
						<div>
							<h2 className='font-semibold'>{agencyName}</h2>
							<p className='text-sm text-muted'>{link.status}</p>
						</div>
						{link.status !== "revoked" ? (
							<form action={revokeAgencyLinkFormAction}>
								<input type='hidden' name='linkId' value={link.id} />
								<button className='rounded-lg border border-danger px-3 py-2 text-danger'>Revoke access</button>
							</form>
						) : null}
					</div>
					{link.status === "proposed" ? (
						<form action={acceptAgencyLinkFormAction} className='mt-4 flex flex-col gap-3'>
							<input type='hidden' name='linkId' value={link.id} />
							<p className='text-sm'>Choose the maximum permissions this agency may use:</p>
							<div className='grid gap-2 md:grid-cols-2'>
								{PERMISSIONS.filter((permission) => link.permissionCeiling.includes(permission)).map((permission) => (
									<label key={permission} className='flex gap-2 text-sm'>
										<input type='checkbox' name='permission' value={permission} defaultChecked />
										{permission}
									</label>
								))}
							</div>
							<button className='w-fit rounded-lg bg-accent px-4 py-2 font-medium text-white'>Approve agency access</button>
						</form>
					) : (
						<p className='mt-3 text-sm text-muted'>{link.permissionCeiling.join(", ") || "No delegated permissions"}</p>
					)}
				</section>
			))}
		</main>
	);
}
