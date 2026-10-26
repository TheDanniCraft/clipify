"use client";

import LocalizedDate from "@components/localizedDate";
import { dismissDashboardContent } from "@actions/contentStates";
import type { DashboardContentItem } from "@lib/dashboardContent";
import { Button, Modal } from "@heroui/react";
import Image from "next/image";
import { useState } from "react";

export default function DashboardContentHost({ items, onStartGuide, onDismissGuide, isVisible = true }: { items: DashboardContentItem[]; onStartGuide?: () => void; onDismissGuide?: () => void; isVisible?: boolean }) {
	const [pending, setPending] = useState(items);
	const [dismissing, setDismissing] = useState(false);
	const current = pending.find((item) => items.some((available) => available.key === item.key));

	if (!current) return null;

	const dismiss = async (startGuide = false) => {
		if (dismissing) return;
		setDismissing(true);
		const result = current.key === "guided-welcome" ? { ok: true } : await dismissDashboardContent(current.key).catch(() => ({ ok: false as const }));
		if (result.ok) {
			setPending((items) => items.filter((item) => item.key !== current.key));
			if (startGuide) onStartGuide?.();
			else onDismissGuide?.();
		}
		setDismissing(false);
	};

	const expiry = current.expiresAt ? <LocalizedDate value={current.expiresAt} /> : null;

	return (
		<Modal.Backdrop
			isOpen={isVisible}
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
						<section className='space-y-3' aria-label={current.expiresAt ? "Pro trial details" : "Getting started"}>
							<p className='text-lg font-semibold text-accent'>{current.highlight.title}</p>
							<p>{current.highlight.text}</p>
							{expiry ? (
								<p className='pt-1 text-sm text-muted'>
									Your Pro trial ends <span className='font-semibold text-foreground'>{expiry}</span>.
								</p>
							) : null}
						</section>
						{onStartGuide && <p className='mt-3 text-sm'>Create your first overlay with a guided tour. Complete the core guide to earn your Clipify Expert badge. You can pause anytime.</p>}
						{current.helpText ? <p className='mt-3 text-sm text-muted'>{current.helpText}</p> : null}
					</Modal.Body>
					<Modal.Footer>
						{onStartGuide && (
							<Button variant='tertiary' isDisabled={dismissing} onPress={() => dismiss()}>
								Maybe later
							</Button>
						)}
						<Button variant='primary' isDisabled={dismissing} onPress={() => dismiss(Boolean(onStartGuide))}>
							{onStartGuide ? "Start guided tour" : current.actionLabel}
						</Button>
					</Modal.Footer>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}
