"use client";

import { Button, Link, Modal } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useState } from "react";

export default function CheckoutFeedback({ children }: { children?: ReactNode }) {
	const params = useSearchParams();
	const [dismissed, setDismissed] = useState(false);
	if (params?.get("checkout") !== "cancelled" || dismissed) return children;

	return (
		<Modal.Backdrop
			isOpen
			onOpenChange={(open) => {
				if (!open) setDismissed(true);
			}}
		>
			<Modal.Container>
				<Modal.Dialog>
					<Modal.CloseTrigger />
					<Modal.Header>
						<Modal.Heading>How was checkout?</Modal.Heading>
					</Modal.Header>
					<Modal.Body>
						<p>If something got in the way, tell us what happened. Your feedback helps us improve Clipify.</p>
					</Modal.Body>
					<Modal.Footer>
						<Button variant='tertiary' onPress={() => setDismissed(true)}>
							Skip
						</Button>
						<Link href='mailto:contact@clipify.us?subject=Clipify%20checkout%20feedback' className={buttonVariants({ variant: "primary" })} onPress={() => setDismissed(true)}>
							Send feedback
						</Link>
					</Modal.Footer>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}
