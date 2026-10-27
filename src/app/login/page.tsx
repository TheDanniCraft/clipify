import { Link } from "@components/heroui-client";
import ErrorToast from "@components/errorToast";
import { validateAuth } from "@actions/auth";
import { redirect } from "next/navigation";
import { readCheckoutIntent } from "@/server/checkoutIntent";
import { legalDocumentRoutes } from "@lib/legal/documents";
import LoginClient from "./LoginClient";
import Logo from "@components/logo";
import { getAuthSession } from "@/auth/session";
import { safeReturnPath } from "@/auth/return-url";

export default async function Login({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
	const parameters = await searchParams;
	const { error, errorCode, returnUrl } = parameters;
	const oauthAuthorization = typeof parameters.client_id === "string" && typeof parameters.sig === "string";
	const rawReturnUrl = typeof returnUrl === "string" ? returnUrl : "";
	const ru = safeReturnPath(rawReturnUrl) ?? "";

	const checkoutIntent = await readCheckoutIntent();
	// The OAuth provider resumes its signed request after sign-in. A login prompt
	// can deliberately require reauthentication even when a session exists.
	const returnDestination = oauthAuthorization ? "" : checkoutIntent ? "/checkout/continue" : ru;
	const [session, loggedInUser] = await Promise.all([process.env.E2E_TEST_MODE === "true" ? null : getAuthSession(), validateAuth()]);
	if (!oauthAuthorization && (session || loggedInUser)) {
		redirect(returnDestination || "/dashboard");
	}

	return (
		<>
			<ErrorToast error={error as string} errorCode={errorCode as string} />

			<main className='flex min-h-dvh items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 px-6 py-12 text-white'>
				<div className='w-full max-w-md'>
					<Link href='/' aria-label='Clipify home' className='mb-10 flex w-fit items-center gap-2 text-xl font-semibold text-white'>
						<Logo size={36} />
						Clipify
					</Link>
					<p className='mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-violet-200'>Your clips, ready for your next stream</p>
					<h1 className='text-3xl font-bold tracking-tight'>Welcome to Clipify</h1>
					<p className='mb-7 mt-4 text-base leading-relaxed text-violet-100'>Connect Twitch to save your playlists and overlay settings. Add your overlay as a browser source in OBS when you are ready.</p>
					<div className='rounded-2xl bg-background p-6 text-foreground shadow-xl'>
						<LoginClient returnUrl={returnDestination} oauthAuthorization={oauthAuthorization} />
						<p className='mt-5 text-center text-sm leading-relaxed text-foreground/75'>{checkoutIntent ? "Your Pro selection is saved. Sign in to continue to checkout." : "Start with a permanent Free plan. Pro is optional."}</p>
					</div>
					<p className='mt-6 text-xs leading-relaxed text-violet-100'>
						By logging in, you agree to our{" "}
						<Link href={legalDocumentRoutes.terms} className='text-xs text-white underline'>
							Terms
						</Link>{" "}
						and{" "}
						<Link href={legalDocumentRoutes.privacy} className='text-xs text-white underline'>
							Privacy Policy
						</Link>
						. We send product update emails by default. You can opt out anytime.
					</p>
					<div className='mt-5 flex gap-5'>
						<Link href='/' className='text-sm text-white'>
							Back to home
						</Link>
						<Link href='https://help.clipify.us' className='text-sm text-white'>
							Setup help
						</Link>
					</div>
				</div>
			</main>
		</>
	);
}
