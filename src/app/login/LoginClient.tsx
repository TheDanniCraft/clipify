"use client";

import { useState } from "react";
import { Button } from "@components/heroui-client";
import { IconBrandTwitch } from "@tabler/icons-react";
import { authClient } from "@/auth/client";

export default function LoginClient({ returnUrl }: { returnUrl: string }) {
	const [pending, setPending] = useState(false);
	const [localError, setLocalError] = useState<string | null>(null);

	async function signInWithTwitch() {
		setPending(true);
		setLocalError(null);
		const result = await authClient.signIn.social({
			provider: "twitch",
			callbackURL: returnUrl || "/dashboard",
			errorCallbackURL: "/login",
		});
		if (result.error) {
			setLocalError("Twitch sign-in could not be started. Please try again.");
			setPending(false);
		}
	}

	return (
		<div className='flex flex-col items-center gap-3'>
			<Button aria-label='Login with Twitch' isDisabled={pending} isPending={pending} onPress={signInWithTwitch} size='lg' variant='primary'>
				<IconBrandTwitch color='#8956FB' />
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
