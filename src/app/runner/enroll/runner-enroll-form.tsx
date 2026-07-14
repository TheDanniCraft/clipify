"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, InputOTP, Label, REGEXP_ONLY_DIGITS_AND_CHARS } from "@heroui/react";
import { IconPlus } from "@tabler/icons-react";

import { submitRunnerEnrollCode } from "./actions";
import RunnerEnrollResult from "./runner-enroll-result";
import { createOwnRunner } from "@actions/runner";

function compactCode(code: string) {
	return code
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, "")
		.slice(0, 8);
}

function formatCode(code: string) {
	const compact = compactCode(code);
	return compact.length > 4 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : compact;
}

function RunnerEnrollFormContent({ onReset }: { onReset: () => void }) {
	const router = useRouter();
	const [state, formAction, isPending] = useActionState(submitRunnerEnrollCode, { status: "idle" });
	const formRef = useRef<HTMLFormElement>(null);
	const [value, setValue] = useState("");
	const [createError, setCreateError] = useState<string | null>(null);
	const [isCreatingRunner, startCreatingRunner] = useTransition();
	const formattedCode = useMemo(() => formatCode(value), [value]);
	const hasSubmittedRef = useRef(false);

	const submitCompletedCode = () => {
		if (hasSubmittedRef.current) return;
		hasSubmittedRef.current = true;
		requestAnimationFrame(() => {
			formRef.current?.requestSubmit();
		});
	};

	const handleCreateRunner = () => {
		setCreateError(null);
		startCreatingRunner(async () => {
			const result = await createOwnRunner("New Hardware Node");
			if (!result.success || !result.runner) {
				setCreateError(result.error === "Runner add-on required" ? "The Self-hosted Runner add-on is required before creating a runner." : "Failed to create runner. Please try again.");
				return;
			}

			router.push(`/dashboard/runners/${result.runner.id}`);
			router.refresh();
		});
	};

	if (state.status !== "idle") {
		return <RunnerEnrollResult state={state} onReset={onReset} />;
	}

	return (
		<>
			<div className='space-y-2'>
				<h1 className='text-2xl font-semibold'>Clipify Runner</h1>
				<p className='text-sm text-muted-foreground'>Enter the device code shown in your runner terminal.</p>
			</div>
			<form
				ref={formRef}
				action={formAction}
				className='flex flex-col gap-4'
				onSubmit={() => {
					hasSubmittedRef.current = true;
				}}
			>
				<input type='hidden' name='code' value={formattedCode} />
				<div className='flex flex-col gap-2'>
					<Label>Device code</Label>
					<InputOTP
						maxLength={8}
						variant='secondary'
						value={value}
						onChange={(nextValue) => {
							setValue(compactCode(nextValue));
							if (nextValue.length < 8) hasSubmittedRef.current = false;
						}}
						onComplete={submitCompletedCode}
						pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
						pasteTransformer={compactCode}
						inputMode='text'
						autoFocus
						autoComplete='one-time-code'
						isDisabled={isPending}
					>
						<InputOTP.Group>
							{Array.from({ length: 4 }, (_, index) => (
								<InputOTP.Slot key={index} index={index} />
							))}
						</InputOTP.Group>
						<InputOTP.Separator />
						<InputOTP.Group>
							{Array.from({ length: 4 }, (_, index) => (
								<InputOTP.Slot key={index + 4} index={index + 4} />
							))}
						</InputOTP.Group>
					</InputOTP>
				</div>
				{isPending ? <p className='text-sm text-muted-foreground'>Checking code...</p> : null}
				<Button type='submit' variant='primary' className='w-full' isDisabled={value.length !== 8 || isPending} isPending={isPending}>
					Continue
				</Button>
			</form>
			<div className='border-t border-divider pt-4 text-center'>
				<p className='text-sm text-muted-foreground'>Don&apos;t have a runner code yet?</p>
				<Button type='button' variant='secondary' className='mt-2' onPress={handleCreateRunner} isPending={isCreatingRunner} isDisabled={isPending || isCreatingRunner}>
					<IconPlus size={16} />
					Create a new runner
				</Button>
				<p className='mt-2 text-xs text-muted-foreground'>Already started a runner? Enter the code shown in its terminal above.</p>
				{createError ? <p className='mt-2 text-sm text-danger'>{createError}</p> : null}
			</div>
		</>
	);
}

export default function RunnerEnrollForm() {
	const [resetKey, setResetKey] = useState(0);
	return <RunnerEnrollFormContent key={resetKey} onReset={() => setResetKey((key) => key + 1)} />;
}
