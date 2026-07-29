"use client";

import { useActionState, useState } from "react";
import { Avatar, Button, Label, ListBox, Select } from "@heroui/react";

import { submitRunnerSelection, type PendingRunnerOption } from "../actions";
import RunnerEnrollResult from "../runner-enroll-result";

function RunnerSelectFormContent({ code, runners, onReset }: { code: string; runners: PendingRunnerOption[]; onReset: () => void }) {
	const [state, formAction, isPending] = useActionState(submitRunnerSelection, { status: "idle" });
	const [runnerId, setRunnerId] = useState("");

	if (state.status !== "idle") {
		return <RunnerEnrollResult state={state} onReset={onReset} />;
	}

	return (
		<>
			<div className='space-y-2'>
				<h1 className='text-2xl font-semibold'>Choose runner</h1>
				<p className='text-sm text-muted-foreground'>Select the pending runner this device should connect to.</p>
			</div>
			<form action={formAction} className='flex flex-col gap-4'>
				<input type='hidden' name='code' value={code} />
				<input type='hidden' name='runnerId' value={runnerId} />
				<Select value={runnerId || null} onChange={(selected) => setRunnerId(String(selected ?? ""))} variant='secondary' placeholder='Select a runner' isRequired>
					<Label>Pending runner</Label>
					<Select.Trigger>
						<Select.Value />
						<Select.Indicator />
					</Select.Trigger>
					<Select.Popover>
						<ListBox>
							{runners.map((runner) => (
								<ListBox.Item key={runner.id} id={runner.id} textValue={`${runner.ownerName} / ${runner.name}`}>
									<Label className='flex min-w-0 items-center'>
										<Avatar className='mr-2 h-6 w-6 shrink-0'>
											<Avatar.Image alt='' src={runner.ownerAvatar} />
											<Avatar.Fallback>{runner.ownerName.slice(0, 2).toUpperCase()}</Avatar.Fallback>
										</Avatar>
										<span className='flex min-w-0 flex-col'>
											<span className='truncate'>{runner.name}</span>
											<span className='truncate text-xs text-muted-foreground'>{runner.ownerName}</span>
										</span>
									</Label>
									<ListBox.ItemIndicator />
								</ListBox.Item>
							))}
						</ListBox>
					</Select.Popover>
				</Select>
				<Button type='submit' variant='primary' className='w-full' isDisabled={!runnerId || isPending} isPending={isPending}>
					Approve runner
				</Button>
			</form>
		</>
	);
}

export default function RunnerSelectForm({ code, runners }: { code: string; runners: PendingRunnerOption[] }) {
	const [resetKey, setResetKey] = useState(0);
	return <RunnerSelectFormContent key={resetKey} code={code} runners={runners} onReset={() => setResetKey((key) => key + 1)} />;
}
