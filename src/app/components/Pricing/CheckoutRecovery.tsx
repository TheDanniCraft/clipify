"use client";

import { useEffect } from "react";
import { Alert, Link } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { trackProductEvent } from "@lib/analytics";

export default function CheckoutRecovery({ status, canRetry }: { status: "cancelled" | "unavailable"; canRetry: boolean }) {
	useEffect(() => {
		trackProductEvent("checkout_returned", { reason: status });
	}, [status]);
	return (
		<Alert status={status === "unavailable" ? "warning" : "default"} className='mx-auto mt-8 max-w-6xl'>
			<Alert.Indicator />
			<Alert.Content>
				<Alert.Title>{status === "cancelled" ? "Checkout cancelled" : "Checkout couldn't be opened"}</Alert.Title>
				<Alert.Description>{canRetry ? "Your plan and billing selection are saved. You can try again or choose a different plan below." : "Choose a plan below to start again. You can also keep using Clipify Free."}</Alert.Description>
				{canRetry ? (
					<Link href='/checkout/continue' className={buttonVariants({ variant: "secondary", className: "mt-3" })}>
						Retry checkout
					</Link>
				) : null}
			</Alert.Content>
		</Alert>
	);
}
