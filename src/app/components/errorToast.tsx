"use client";
import { notify as addToast } from "@lib/toast";

export default function ErrorToast({ error, errorCode }: { error: string; errorCode: string }) {
	if (error) {
		let errorMessage;
		let errorDescription = "It seems like something went wrong while trying to authenticate with Twitch. Please try again later, if the issue persists contact the developers";
		switch (error) {
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
