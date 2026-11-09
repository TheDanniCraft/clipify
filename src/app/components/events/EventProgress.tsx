"use client";
import { Stepper } from "@heroui-pro/react";
import type { EventPhase } from "@lib/events";
export default function EventProgress({ phase, review }: { phase: EventPhase; review: boolean }) {
	const steps = [{ id: "announcement", label: "Soon" }, { id: "submissions", label: "Nominations" }, ...(review ? [{ id: "review", label: "Review" }] : []), { id: "voting", label: "Voting" }, { id: "closed", label: "Show" }, { id: "results", label: "Results" }];
	return (
		<div className='overflow-x-auto py-3'>
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
