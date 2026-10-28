"use client";

import { useState } from "react";
import { Button } from "@heroui/react";
import { recoverAccountDeletion } from "@actions/subscription";
import ReauthenticationModal from "@components/reauthenticationModal";

export default function RecoveryAction({ requestId }: { requestId: string }) {
	const [pending, setPending] = useState(false);
	const [verify, setVerify] = useState(false);
	const [error, setError] = useState(false);
	async function recover() {
		setPending(true);
		setError(false);
		try {
			const result = await recoverAccountDeletion(requestId);
			if (!result.success) {
				setVerify(true);
				return;
			}
			window.location.assign("/dashboard");
		} catch {
			setError(true);
		} finally {
			setPending(false);
		}
	}
	return (
		<div>
			{error && (
				<p role='alert' className='mb-3 text-danger'>
					Your account could not be recovered. Please try again.
				</p>
			)}
			<Button variant='primary' isPending={pending} onPress={() => void recover()}>
				Recover my account
			</Button>
			<ReauthenticationModal isOpen={verify} onClose={() => setVerify(false)} callbackURL='/dashboard/settings/account/recovery' errorCallbackURL='/dashboard/settings/account/recovery?verification=failed' />
		</div>
	);
}
