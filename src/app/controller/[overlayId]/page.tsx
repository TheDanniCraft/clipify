import Link from "next/link";
import jwt from "jsonwebtoken";
import { getOverlayOwnerPlanPublic, getOverlayWithEditAccess } from "@actions/database";
import { validateAuth } from "@actions/auth";
import { Plan } from "@types";
import ControllerClient from "./controllerClient";
import { redirect } from "next/navigation";

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
}: {
	params: Promise<{ overlayId: string }>;
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
	const { overlayId } = await params;
	const user = await validateAuth();

	if (!user) {
		redirect(`/login?returnUrl=${encodeURIComponent(`/controller/${overlayId}`)}`);
	}

	const overlay = await getOverlayWithEditAccess(overlayId);
	if (!overlay) {
		return <AccessSurface eyebrow='Controller Access' title='Access denied' description='Only the streamer or editors with access to this overlay can use the remote controller.' />;
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

	const controllerToken = jwt.sign(
		{ overlayId, userId: user.id },
		process.env.JWT_SECRET!,
		{ algorithm: "HS256", issuer: "clipify-controller", expiresIn: "12h" },
	);

	return <ControllerClient overlayId={overlayId} controllerToken={controllerToken} />;
}
