import { socialPreview } from "@lib/socialPreview";
import type { Metadata } from "next";
import { Link, Card, CardHeader, CardContent } from "@components/heroui-client";
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
				<div className='w-full max-w-md'>
					<Link href='/' className='mb-8 inline-flex items-center gap-3 font-semibold text-foreground'>
						<Logo size={32} />
						Clipify
					</Link>
					<Card className='border border-border p-3 shadow-none sm:p-5'>
						<CardHeader>
							<h1 className='text-3xl font-semibold tracking-tight'>{oauthAuthorization ? "Connect your account" : checkoutIntent ? "Your Pro plan is selected" : "Put your clips to work."}</h1>
							<p className='mt-3 text-muted'>{oauthAuthorization ? "Sign in with Twitch to continue. You can review the app's requested access before authorizing it." : checkoutIntent ? "Sign in with Twitch to continue to secure checkout. Your billing selection is saved." : "Sign in with Twitch, choose your clips, and create your first overlay. New to Clipify? Your account is created when you connect."}</p>
						</CardHeader>
						<CardContent className='space-y-6'>
							<LoginClient returnUrl={returnDestination} oauthAuthorization={oauthAuthorization} />
							{!oauthAuthorization && !checkoutIntent ? <p className='text-sm text-muted'>Start on Free. Eligible new creators get seven days of Pro without a card, then continue on Free unless they subscribe.</p> : null}
							<p className='text-xs leading-relaxed text-muted'>
								By logging in, you agree to our{" "}
								<Link href={legalDocumentRoutes.terms} className='text-xs underline'>
									Terms
								</Link>{" "}
								and{" "}
								<Link href={legalDocumentRoutes.privacy} className='text-xs underline'>
									Privacy
								</Link>
								. We send you product update emails by default. You can opt out anytime.
							</p>
						</CardContent>
					</Card>
					<Link href='/' className='mt-6 text-sm'>
						Back to Clipify
					</Link>
				</div>
			</main>
		</>
	);
}
