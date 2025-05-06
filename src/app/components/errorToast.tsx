"use client";

import { addToast, Code } from "@heroui/react";

export default function ErrorToast({ error, errorCode }: { error: string; errorCode: string }) {
	if (error) {
		let errorMessage;
		switch (error) {
			case "twitchAPiError":
				errorMessage = "Twitch API error";
				break;
			case "stateError":
				errorMessage = "State error";
				break;
			default:
				errorMessage = "Unknown error";
		}

		addToast({
			title: `An unecpected error occurred: ${errorMessage}`,
			description: (
				<>
					It seems like something went wrong while trying to authenticate with Twitch. Please try again later, if the issue persists contact the developers
					{errorCode && (
						<>
							{" and specify this error code: "}
							<Code color='danger'>{errorCode}</Code>
						</>
					)}
					.
				</>
			),
			color: "danger",
			timeout: 20,
		});
	}

	return <></>;
}
