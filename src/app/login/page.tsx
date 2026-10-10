import { Link } from "@components/heroui-client";
import ErrorToast from "@components/errorToast";
import { validateAuth } from "@actions/auth";
import { redirect } from "next/navigation";
import { readCheckoutIntent } from "@/server/checkoutIntent";
import { legalDocumentRoutes } from "@lib/legal/documents";
import LoginClient from "./LoginClient";
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

			<div className='min-h-screen min-w-screen flex items-center justify-center bg-gradient-to-br from-brand-800 to-brand-400'>
				<div className='flex flex-col items-center'>
					<LoginClient returnUrl={returnDestination} oauthAuthorization={oauthAuthorization} />

					<div className='mt-2 flex max-w-[240px] flex-col items-center text-center text-xs text-gray-400'>
						<p>
							By logging in, you agree to our{" "}
							<Link href={legalDocumentRoutes.terms} className='text-xs text-foreground'>
								Terms
							</Link>{" "}
							and{" "}
							<Link href={legalDocumentRoutes.privacy} className='text-xs text-foreground'>
								Privacy
							</Link>
							. We send you product update emails by default. You can opt out anytime.
						</p>
					</div>
				</div>
			</div>
		</>
	);
}
