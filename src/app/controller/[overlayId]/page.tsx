import Link from "next/link";
import { getOverlayBySecret, getOverlayOwnerPlanPublic } from "@actions/database";
import { Plan } from "@types";
import ControllerClient from "./controllerClient";

function AccessSurface({
	eyebrow,
	title,
	description,
	ctaLabel,
	ctaHref,
}: {
	eyebrow: string;
	title: string;
	description: string;
	ctaLabel?: string;
	ctaHref?: string;
}) {
	return (
		<main className='min-h-screen bg-background px-6 py-12'>
			<div className='mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-3xl items-center justify-center'>
				<div className='w-full rounded-[32px] border border-default-200 bg-content1 p-8 shadow-sm'>
					<div className='mx-auto flex max-w-xl flex-col items-center text-center'>
						<p className='text-xs font-bold uppercase tracking-[0.28em] text-primary'>{eyebrow}</p>
						<h1 className='mt-3 text-3xl font-bold tracking-tight text-foreground'>{title}</h1>
						<p className='mt-3 text-default-500'>{description}</p>
					</div>
					{ctaLabel && ctaHref ? (
						<div className='mt-6 flex justify-center'>
							<Link href={ctaHref} className='inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-white transition hover:opacity-90'>
								{ctaLabel}
							</Link>
						</div>
					) : null}
				</div>
			</div>
		</main>
	);
}

export default async function ControllerPage({
	params,
	searchParams,
}: {
	params: Promise<{ overlayId: string }>;
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
	const { overlayId } = await params;
	const query = await searchParams;
	const secret = query?.secret;
	const overlaySecret = Array.isArray(secret) ? secret[0] : secret;

	if (!overlaySecret) {
		return <AccessSurface eyebrow='Controller Access' title='Missing overlay secret' description='Open this controller with the secure query string attached, for example `?secret=...`.' />;
	}

	const overlay = await getOverlayBySecret(overlayId, overlaySecret);
	if (!overlay) {
		return <AccessSurface eyebrow='Controller Access' title='Invalid controller link' description='The overlay ID and secret do not match. Regenerate the controller link from your dashboard and try again.' />;
	}

	const ownerPlan = await getOverlayOwnerPlanPublic(overlayId);
	if (ownerPlan !== Plan.Pro) {
		return (
			<AccessSurface
				eyebrow='Pro Feature'
				title='This feature is Pro only'
				description='The remote control panel is available on Clipify Pro. Upgrade the overlay owner account to unlock live playback controls.'
				ctaLabel='Upgrade now'
				ctaHref='/dashboard/settings'
			/>
		);
	}

	return <ControllerClient overlayId={overlayId} secret={overlaySecret} />;
}
