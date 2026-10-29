import type { Metadata } from "next";
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

export const metadata: Metadata = {
	title: "Sign in with Twitch | Clipify",
	description: "Connect your Twitch account to manage Clipify playlists and OBS overlays.",
	alternates: { canonical: "https://clipify.us/login" },
	openGraph: { title: "Sign in with Twitch | Clipify", url: "https://clipify.us/login" },
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

			<main className='flex min-h-dvh flex-col bg-background px-6 text-foreground'>
				<header className='mx-auto flex w-full max-w-6xl items-center justify-between py-6'>
					<Link href='/' aria-label='Clipify home' className='flex items-center gap-2 text-lg font-semibold text-foreground'>
						<Logo size={32} />
						Clipify
					</Link>
					<Link href='https://help.clipify.us/hc/clipify/articles/1769328012-getting-started-with-clipify' className='text-sm'>
						Setup help
					</Link>
				</header>
				<div className='mx-auto flex w-full max-w-sm flex-1 flex-col justify-center pb-20 pt-10'>
					<h1 className='text-3xl font-bold tracking-tight'>Welcome to Clipify</h1>
					<p className='mb-8 mt-3 leading-relaxed text-foreground/75'>Sign in with Twitch to manage your clips and get your next stream ready.</p>
					<LoginClient returnUrl={returnDestination} oauthAuthorization={oauthAuthorization} />
					<p className='mt-6 text-sm leading-relaxed text-foreground/75'>{checkoutIntent ? "Your Pro selection is saved. Sign in to continue to checkout." : "Free to get started. Eligible new creators also get seven days of Pro. No card required."}</p>
					{!checkoutIntent && <p className='mt-2 text-sm leading-relaxed text-foreground/75'>Continue on Free afterward unless you choose a paid plan.</p>}
					<p className='mt-8 text-xs leading-relaxed text-foreground/65'>
						By logging in, you agree to our{" "}
						<Link href={legalDocumentRoutes.terms} className='text-xs underline'>
							Terms
						</Link>{" "}
						and{" "}
						<Link href={legalDocumentRoutes.privacy} className='text-xs underline'>
							Privacy Policy
						</Link>
						. We send product update emails by default. You can opt out anytime.
					</p>
				</div>
			</main>
		</>
	);
}
