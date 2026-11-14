"use client";
import { useEffect, useRef } from "react";
import { Stepper } from "@heroui-pro/react";
import type { EventPhase } from "@lib/events";
export default function EventProgress({ phase, review }: { phase: EventPhase; review: boolean }) {
	const container = useRef<HTMLDivElement>(null);
	useEffect(() => {
		function revealCurrent() {
			const root = container.current,
				active = root?.querySelector<HTMLElement>('[aria-current="step"]');
			if (!root || !active) return;
			const bounds = active.getBoundingClientRect(),
				viewport = root.getBoundingClientRect();
			root.scrollLeft += bounds.left - viewport.left - (root.clientWidth - bounds.width) / 2;
		}
		revealCurrent();
		window.addEventListener("resize", revealCurrent);
		return () => window.removeEventListener("resize", revealCurrent);
	}, [phase, review]);
	const steps = [{ id: "announcement", label: "Soon" }, { id: "submissions", label: "Nominations" }, ...(review ? [{ id: "review", label: "Review" }] : []), { id: "voting", label: "Voting" }, { id: "closed", label: "Show" }, { id: "results", label: "Results" }];
	return (
		<div ref={container} className='overflow-x-auto py-3'>
			<Stepper
				aria-label='Event progress'
				currentStep={Math.max(
					0,
					steps.findIndex((step) => step.id === phase),
				)}
				size='sm'
				className='min-w-[520px]'
			>
				{steps.map((step) => (
					<Stepper.Step key={step.id}>
						<Stepper.Indicator />
						<Stepper.Content>
							<Stepper.Title>{step.label}</Stepper.Title>
						</Stepper.Content>
						<Stepper.Separator />
					</Stepper.Step>
				))}
			</Stepper>
		</div>
	);
}
