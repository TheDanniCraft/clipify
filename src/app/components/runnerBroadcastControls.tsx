"use client";

import { PLAYBACK_TIMEOUT_MESSAGE } from "../../../packages/runner/src/presentation";
import { Button } from "@heroui/react";
import { IconPlayerPlay, IconPlayerStop } from "@tabler/icons-react";

type Props = {
	online: boolean;
	desiredState: string;
	actualState: string;
	canStart: boolean;
	requiresConnection?: boolean;
	clipPlayback: boolean;
	playbackTimedOut?: boolean;
	onStart: () => void;
	onStop: (mode: "graceful" | "immediate") => void;
};

export default function RunnerBroadcastControls({ online, desiredState, actualState, canStart, requiresConnection, clipPlayback, playbackTimedOut, onStart, onStop }: Props) {
	const finishing = desiredState === "stopped" && actualState === "running";
	return (
		<div className='flex flex-col gap-2 sm:ml-auto w-full sm:w-auto sm:max-w-md'>
			<div className='flex flex-wrap gap-3'>
				<Button className='bg-success text-success-foreground' onPress={onStart} isDisabled={!online || !canStart || desiredState === "running" || finishing}>
					<IconPlayerPlay size={18} /> Start
				</Button>
				<Button className='bg-danger text-danger-foreground' onPress={() => onStop("graceful")} isDisabled={desiredState === "stopped"}>
					<IconPlayerStop size={18} /> Stop
				</Button>
				{finishing && online && (
					<Button variant='secondary' className='text-danger' onPress={() => onStop("immediate")}>
						Stop now
					</Button>
				)}
			</div>
			{playbackTimedOut && (
				<p role='alert' className='text-sm text-danger'>
					{PLAYBACK_TIMEOUT_MESSAGE}
				</p>
			)}
			{requiresConnection && <p className='text-xs text-muted'>Keep Runner connected to the internet. After about five minutes without a connection, it finishes playback and stops.</p>}
			{finishing && (
				<p role='status' className='text-sm text-muted'>
					{!online ? "Runner offline. Waiting for stop confirmation." : clipPlayback ? "Finishing current clip…" : "Stopping broadcast…"}
				</p>
			)}
		</div>
	);
}
