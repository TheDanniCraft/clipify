import NextLink from "next/link";
import { buttonVariants } from "@heroui/styles";
import { IconAlertCircle, IconCircleCheck, IconCircleX } from "@tabler/icons-react";

import type { RunnerEnrollActionState } from "./actions";

type RunnerEnrollResultProps = {
	state: Exclude<RunnerEnrollActionState, { status: "idle" }>;
	onReset?: () => void;
};

function getResultContent(state: RunnerEnrollResultProps["state"]) {
	if (state.status === "approved") {
		return {
			tone: "success" as const,
			title: "Successfully registered runner",
			description: "Your runner is connected to Clipify.",
			actionHref: `/dashboard/runners/${state.runnerId}`,
			actionLabel: "Go to runner",
		};
	}

	if (state.status === "already-approved") {
		return {
			tone: "success" as const,
			title: "Runner already registered",
			description: "This code has already been approved.",
			actionHref: `/dashboard/runners/${state.runnerId}`,
			actionLabel: "Go to runner",
		};
	}

	if (state.status === "expired") {
		return {
			tone: "danger" as const,
			title: "Code expired",
			description: "Start enrollment again from the runner terminal.",
			actionHref: "/runner/enroll",
			actionLabel: "Enter a new code",
		};
	}

	if (state.status === "unauthorized") {
		return {
			tone: "danger" as const,
			title: "You do not have access to this runner",
			description: "Use an account that can manage the runner owner.",
			actionHref: "/runner/enroll",
			actionLabel: "Back to enrollment",
		};
	}

	if (state.status === "runner-unavailable") {
		return {
			tone: "warning" as const,
			title: "Runner is no longer available",
			description: "Choose another pending runner for this device.",
			actionHref: `/runner/enroll/select?code=${encodeURIComponent(state.code)}`,
			actionLabel: "Choose runner",
		};
	}

	if (state.status === "no-pending-runners") {
		return {
			tone: "warning" as const,
			title: "No runner available",
			description: "Create or download a runner from your dashboard, then enter the new code.",
			actionHref: "/dashboard",
			actionLabel: "Open dashboard",
		};
	}

	if (state.status === "missing-runner") {
		return {
			tone: "warning" as const,
			title: "Choose a runner",
			description: "Select the pending runner this device should connect to.",
			actionHref: "/runner/enroll",
			actionLabel: "Back to enrollment",
		};
	}

	if (state.status === "missing-code") {
		return {
			tone: "danger" as const,
			title: "Enter a runner code",
			description: "Use the device code shown in your runner terminal.",
			actionHref: "/runner/enroll",
			actionLabel: "Try again",
		};
	}

	return {
		tone: "danger" as const,
		title: "Invalid runner code",
		description: "Check the code in your runner terminal and try again.",
		actionHref: "/runner/enroll",
		actionLabel: "Try again",
	};
}

export default function RunnerEnrollResult({ state, onReset }: RunnerEnrollResultProps) {
	const result = getResultContent(state);
	const iconClassName = result.tone === "success" ? "text-success" : result.tone === "warning" ? "text-warning" : "text-danger";
	const Icon = result.tone === "success" ? IconCircleCheck : result.tone === "warning" ? IconAlertCircle : IconCircleX;
	const canReset = Boolean(onReset && result.actionHref === "/runner/enroll");

	return (
		<div className='flex min-h-[18rem] flex-col items-center justify-center gap-5 text-center'>
			<Icon className={iconClassName} size={56} stroke={1.8} />
			<div className='space-y-2'>
				<h1 className='text-2xl font-semibold'>{result.title}</h1>
				<p className='text-sm text-muted-foreground'>{result.description}</p>
			</div>
			{canReset ? (
				<button type='button' className={buttonVariants({ variant: "secondary" })} onClick={onReset}>
					{result.actionLabel}
				</button>
			) : (
				<NextLink href={result.actionHref} className={buttonVariants({ variant: result.tone === "success" ? "primary" : "secondary" })}>
					{result.actionLabel}
				</NextLink>
			)}
		</div>
	);
}
