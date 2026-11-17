"use client";

import { trackEvent } from "@lib/analytics";
import { useState } from "react";
import { Button } from "@components/heroui-client";
import { IconBrandTwitch } from "@tabler/icons-react";
import { authClient } from "@/auth/client";
import { restoreOAuthLoginRetry, saveOAuthLoginRetry } from "@/auth/oauth-login-retry";

export default function LoginClient({ returnUrl, oauthAuthorization = false }: { returnUrl: string; oauthAuthorization?: boolean }) {
	const [pending, setPending] = useState(false);
	const [localError, setLocalError] = useState<string | null>(null);
	const [retryUnavailable, setRetryUnavailable] = useState(false);

	async function signInWithTwitch() {
		setPending(true);
		setLocalError(null);
		trackEvent("auth_started", { provider: "twitch", source: oauthAuthorization ? "oauth_authorization" : returnUrl === "/checkout/continue" ? "checkout" : "login" });
		try {
			if (oauthAuthorization && new URLSearchParams(window.location.search).has("oauthRetry")) {
				const path = restoreOAuthLoginRetry(window.sessionStorage, window.location.search);
				if (!path) {
					setRetryUnavailable(true);
					setLocalError("This sign-in request expired. Return to the app and start sign-in again.");
					setPending(false);
					return;
				}
				window.history.replaceState(window.history.state, "", path);
			}
			const result = await authClient.signIn.social({
				provider: "twitch",
				callbackURL: returnUrl || "/dashboard",
				// The provider client already carries the signed request in OAuth state.
				errorCallbackURL: oauthAuthorization ? saveOAuthLoginRetry(window.sessionStorage, `${window.location.pathname}${window.location.search}`) : returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : "/login",
			});
			if (result.error) {
				trackEvent("auth_failed", { provider: "twitch", reason: "start_rejected" });
				setLocalError("Twitch sign-in could not be started. Please try again.");
				setPending(false);
			}
		} catch {
			trackEvent("auth_failed", { provider: "twitch", reason: "network" });
			setLocalError("Twitch sign-in could not be started. Please try again.");
			setPending(false);
		}
	}

	return (
		<div className='flex flex-col items-center gap-3'>
			<Button aria-label='Login with Twitch' isDisabled={pending || retryUnavailable} isPending={pending} onPress={signInWithTwitch} fullWidth size='lg' variant='primary'>
				<IconBrandTwitch aria-hidden='true' />
				{pending ? "Connecting to Twitch…" : "Login with Twitch"}
			</Button>
			{localError ? (
				<p className='max-w-sm text-center text-sm text-danger' role='alert'>
					{localError}
				</p>
			) : null}
		</div>
	);
}
