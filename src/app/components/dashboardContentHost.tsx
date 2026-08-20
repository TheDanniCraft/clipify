"use client";

import { dismissDashboardContent } from "@actions/contentStates";
import type { DashboardContentItem } from "@lib/dashboardContent";
import { Button, Modal } from "@heroui/react";
import Image from "next/image";
import { useState } from "react";

export default function DashboardContentHost({ items }: { items: DashboardContentItem[] }) {
	const [pending, setPending] = useState(items);
	const [dismissing, setDismissing] = useState(false);
	const current = pending[0];

	if (!current) return null;

	const dismiss = async () => {
		if (dismissing) return;
		setDismissing(true);
		const result = await dismissDashboardContent(current.key).catch(() => ({ ok: false as const }));
		if (result.ok) setPending((items) => items.filter((item) => item.key !== current.key));
		setDismissing(false);
	};

	const expiry = current.expiresAt ? new Date(current.expiresAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : null;

	return (
		<Modal>
			<Modal.Backdrop
				isOpen
				isDismissable={!dismissing}
				onOpenChange={(open) => {
					if (!open) void dismiss();
				}}
			>
				<Modal.Container>
					<Modal.Dialog>
						<Modal.CloseTrigger />
						<Modal.Header>
							<div className='flex items-center gap-4 pr-8'>
								<Image src={current.image.src} alt={current.image.alt} width={88} height={88} className='h-20 w-20 shrink-0 object-contain' />
								<div>
									<Modal.Heading>{current.headline}</Modal.Heading>
									<p className='mt-1 text-sm text-muted'>{current.intro}</p>
								</div>
							</div>
						</Modal.Header>
						<Modal.Body>
							<section className='space-y-3' aria-label='Pro trial details'>
								<p className='text-lg font-semibold text-accent'>{current.highlight.title}</p>
								<p>{current.highlight.text}</p>
								{expiry ? (
									<p className='pt-1 text-sm text-muted'>
										Your Pro trial ends <span className='font-semibold text-foreground'>{expiry}</span>.
									</p>
								) : null}
							</section>
							{current.helpText ? <p className='mt-3 text-sm text-muted'>{current.helpText}</p> : null}
						</Modal.Body>
						<Modal.Footer>
							<Button variant='primary' isDisabled={dismissing} onPress={dismiss}>
								{current.actionLabel}
							</Button>
						</Modal.Footer>
					</Modal.Dialog>
				</Modal.Container>
			</Modal.Backdrop>
		</Modal>
	);
}
