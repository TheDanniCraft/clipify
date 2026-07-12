import NextLink from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@heroui/styles";
import { IconAlertCircle } from "@tabler/icons-react";

import { validateAuth } from "@actions/auth";
import { Card, CardContent } from "@components/heroui-client";
import { getAccessiblePendingRunners } from "../actions";
import { isValidUserCode, normalizeUserCode } from "../code";
import RunnerSelectForm from "./runner-select-form";

type RunnerSelectPageProps = {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function readParam(value: string | string[] | undefined) {
	return Array.isArray(value) ? value[0] : value;
}

export default async function RunnerSelectPage({ searchParams }: RunnerSelectPageProps) {
	const params = await searchParams;
	const rawCode = readParam(params.code);
	const code = rawCode ? normalizeUserCode(rawCode) : "";
	if (!code || !isValidUserCode(code)) redirect("/runner/enroll");

	const user = await validateAuth();
	if (!user) {
		redirect(`/auth?returnUrl=${encodeURIComponent(`/runner/enroll/select?code=${encodeURIComponent(code)}`)}`);
	}

	const runnerOptions = await getAccessiblePendingRunners(user.id);

	return (
		<main className='min-h-screen bg-background text-foreground flex items-center justify-center px-4'>
			<Card className='w-full max-w-md border border-border bg-card'>
				<CardContent className='flex flex-col gap-6 p-6'>
					{runnerOptions.length ? (
						<RunnerSelectForm code={code} runners={runnerOptions} />
					) : (
						<div className='flex min-h-[18rem] flex-col items-center justify-center gap-5 text-center'>
							<IconAlertCircle className='text-warning' size={56} stroke={1.8} />
							<div className='space-y-2'>
								<h1 className='text-2xl font-semibold'>No runner available</h1>
								<p className='text-sm text-muted-foreground'>Create or download a runner from your dashboard, then enter the new code.</p>
							</div>
							<NextLink href='/dashboard' className={buttonVariants({ variant: "secondary" })}>
								Open dashboard
							</NextLink>
						</div>
					)}
				</CardContent>
			</Card>
		</main>
	);
}
