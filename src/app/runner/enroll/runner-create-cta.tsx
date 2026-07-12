"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@heroui/react";
import { IconPlus } from "@tabler/icons-react";

import { createOwnRunner } from "@actions/runner";

export default function RunnerCreateCta() {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	const handleCreate = () => {
		setError(null);
		startTransition(async () => {
			const result = await createOwnRunner("New Hardware Node");
			if (!result.success || !result.runner) {
				setError(result.error === "Runner add-on required" ? "The runner add-on is required before creating a runner." : "Failed to create runner.");
				return;
			}

			router.push(`/dashboard/runners/${result.runner.id}`);
			router.refresh();
		});
	};

	return (
		<div className='flex flex-col items-center gap-3'>
			<Button type='button' variant='primary' className='w-full' onPress={handleCreate} isPending={isPending}>
				<IconPlus size={16} />
				Create runner
			</Button>
			{error ? <p className='text-sm text-danger'>{error}</p> : null}
		</div>
	);
}
