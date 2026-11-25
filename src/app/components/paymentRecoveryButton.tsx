"use client";

import { Button } from "@heroui/react";
import { useState } from "react";
import { notify } from "@lib/toast";

export default function PaymentRecoveryButton({ onResolved }: { onResolved: () => void }) {
	const [pending, setPending] = useState(false);
	const [failed, setFailed] = useState(false);

	async function recoverPayment() {
		setPending(true);
		setFailed(false);
		try {
			const { getPaymentRecoveryLink } = await import("@actions/subscription");
			const result = await getPaymentRecoveryLink();
			if ("url" in result) {
				window.location.assign(result.url);
			} else if (result.error === "not_due") {
				onResolved();
				notify({ title: "No overdue Pro payment found", color: "success" });
			} else {
				setFailed(true);
			}
		} catch {
			setFailed(true);
		} finally {
			setPending(false);
		}
	}

	return (
		<div className='flex flex-col items-end gap-2'>
			<Button variant='primary' isPending={pending} onPress={recoverPayment}>
				Pay now
			</Button>
			{failed && (
				<p role='alert' className='text-sm text-danger'>
					Could not open Stripe. Please try again.
				</p>
			)}
		</div>
	);
}
