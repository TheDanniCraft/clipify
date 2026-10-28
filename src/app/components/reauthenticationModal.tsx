"use client";

import { useState } from "react";
import { Button, Modal } from "@heroui/react";
import ControlledModal from "@components/controlledModal";
import { authClient } from "@/auth/client";

export default function ReauthenticationModal({ isOpen, onClose, callbackURL, errorCallbackURL, provider = "twitch" }: { isOpen: boolean; onClose: () => void; callbackURL: string; errorCallbackURL: string; provider?: "twitch" | "google" }) {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState(false);
	async function signIn() {
		setPending(true);
		setError(false);
		try {
			const result = await authClient.signIn.social({ provider, callbackURL, errorCallbackURL });
			if (result.error) throw new Error("SIGN_IN_NOT_STARTED");
		} catch {
			setError(true);
		} finally {
			setPending(false);
		}
	}
	return (
		<ControlledModal
			variant='blur'
			showCloseButton={!pending}
			isOpen={isOpen}
			onClose={() => {
				if (!pending) onClose();
			}}
		>
			<Modal.Header>
				<Modal.Heading>Sign in again to continue</Modal.Heading>
			</Modal.Header>
			<Modal.Body>
				<p>To verify it&apos;s you, please sign in again. Then you can return and finish this action.</p>
				{error && (
					<p role='alert' className='text-danger'>
						Sign-in could not start. Please try again.
					</p>
				)}
			</Modal.Body>
			<Modal.Footer>
				<Button variant='tertiary' onPress={onClose} isDisabled={pending}>
					Cancel
				</Button>
				<Button variant='primary' onPress={() => void signIn()} isPending={pending}>
					Continue with {provider === "twitch" ? "Twitch" : "Google"}
				</Button>
			</Modal.Footer>
		</ControlledModal>
	);
}
