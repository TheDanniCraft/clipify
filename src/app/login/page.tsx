import { socialPreview } from "@lib/socialPreview";
import type { Metadata } from "next";
import { Link } from "@components/heroui-client";
import Logo from "@components/logo";
import ErrorToast from "@components/errorToast";
import { validateAuth } from "@actions/auth";
import { redirect } from "next/navigation";
import { readCheckoutIntent } from "@/server/checkoutIntent";
import { legalDocumentRoutes } from "@lib/legal/documents";
import LoginClient from "./LoginClient";
import { getAuthSession } from "@/auth/session";
import { safeReturnPath } from "@/auth/return-url";

export const metadata: Metadata = {
	title: "Sign in with Twitch | Clipify",
	description: "Connect your Twitch account to manage Clipify playlists and OBS overlays.",
	alternates: { canonical: "https://clipify.us/login" },
	openGraph: { ...socialPreview, title: "Sign in with Twitch | Clipify", url: "https://clipify.us/login" },
	robots: { index: false, follow: false },
};

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

			<main className='flex min-h-svh items-center justify-center bg-background px-6 py-12 pb-48 sm:pb-12'>
				<div className='w-full max-w-sm text-center'>
					<Link href='/' className='mb-8 inline-flex items-center gap-3 font-semibold text-foreground'>
						<Logo size={32} />
						Clipify
					</Link>
					<h1 className='text-3xl font-semibold tracking-tight'>{oauthAuthorization ? "Connect your account" : checkoutIntent ? "Your Pro plan is selected" : "Sign in to Clipify"}</h1>
					<p className='mt-3 leading-relaxed text-muted'>{oauthAuthorization ? "Sign in with Twitch to review this app’s requested access." : checkoutIntent ? "Sign in with Twitch to continue to checkout. Your billing selection is saved." : "Use your Twitch account. New here? We’ll create your Clipify account when you connect."}</p>
					<div className='mt-8'>
						<LoginClient returnUrl={returnDestination} oauthAuthorization={oauthAuthorization} />
					</div>
					<p className='mt-8 text-xs leading-relaxed text-muted'>
						By continuing, you agree to our{" "}
						<Link href={legalDocumentRoutes.terms} className='text-xs underline'>
							Terms
						</Link>
						. Read our{" "}
						<Link href={legalDocumentRoutes.privacy} className='text-xs underline'>
							Privacy Policy
						</Link>
						.
					</p>
					<p className='mt-3 text-xs leading-relaxed text-muted'>Product emails are on by default. Unsubscribe anytime.</p>
				</div>
			</main>
		</>
	);
}
