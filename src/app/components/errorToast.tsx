"use client";
import { notify as addToast } from "@lib/toast";

export default function ErrorToast({ error, errorCode }: { error: string; errorCode: string }) {
	if (error) {
		let errorMessage;
		let errorDescription = "It seems like something went wrong while trying to authenticate with Twitch. Please try again later, if the issue persists contact the developers";
		switch (error) {
			case "access_denied":
			case "TWITCH_CONSENT_DECLINED":
				errorMessage = "Twitch authorization was declined";
				errorDescription = "Clipify did not receive permission to access your Twitch account. You can retry when you are ready.";
				break;
			case "state_not_found":
			case "state_invalid":
			case "state_mismatch":
			case "TWITCH_STATE_EXPIRED":
				errorMessage = "Sign-in session expired";
				errorDescription = "Please restart Twitch sign-in from this page.";
				break;
			case "TWITCH_INSUFFICIENT_SCOPES":
				errorMessage = "Required Twitch permissions are missing";
				errorDescription = "Clipify needs the listed Twitch permissions to operate your creator account. Please retry and approve the requested access.";
				break;
			case "account_already_linked_to_different_user":
			case "TWITCH_IDENTITY_CONFLICT":
				errorMessage = "Twitch account conflict";
				errorDescription = "This Twitch account is already connected to another Clipify identity. Contact support rather than creating another account.";
				break;
			case "twitchAPiError":
				errorMessage = "Twitch API error";
				break;
			case "stateError":
				errorMessage = "State error";
				break;
			case "accountDisabled":
				errorMessage = "Account disabled";
				errorDescription = "Your account is currently disabled. Please contact support if you think this is a mistake.";
				break;
			default:
				errorMessage = "Unknown error";
		}

		addToast({
			title: `An unexpected error occurred: ${errorMessage}`,
			description: (
				<>
					{errorDescription}
					{errorCode && (
						<>
							{" and specify this error code: "}
							<code className='inline-block h-fit whitespace-nowrap rounded-sm bg-danger/20 px-2 py-1 font-mono text-sm font-normal text-danger'>{errorCode}</code>
						</>
					)}
					.
				</>
			),
			color: "danger",
			timeout: 8000,
		});
	}

	return <></>;
}
