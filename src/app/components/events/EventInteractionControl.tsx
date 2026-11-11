"use client";
import { useEffect, useState } from "react";
import { Button, Spinner } from "@heroui/react";
import { eventInteractionAction } from "@actions/events";
import type { EventInteractionState } from "@lib/eventInteractions";
export default function EventInteractionControl({ eventId, secret, slideId, type, wait, winner, onState }: { eventId: string; secret: string; slideId: string; type: "poll" | "prediction"; wait: boolean; winner: boolean; onState: (value: { slideId: string; blocked: boolean }) => void }) {
	const [state, setState] = useState<EventInteractionState | null>(null);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(true);
	const [attempt, setAttempt] = useState(0);
	const [seconds, setSeconds] = useState(0);
	useEffect(() => {
		let active = true;
		let timer: ReturnType<typeof setTimeout>;
		async function read(action: "start" | "status" | "resolve") {
			try {
				const result = await eventInteractionAction(eventId, secret, slideId, action);
				if (!active) return;
				setBusy(false);
				if (!result.ok) {
					setError(result.code === "LIMIT_REACHED" ? "The nominee count does not fit this Twitch interaction." : result.code === "CONFLICT" ? "Another Twitch interaction is running. Finish it in Twitch, then retry." : "Twitch could not confirm the interaction. Retry or skip it for this category.");
					onState({ slideId, blocked: wait });
					return;
				}
				setState(result.state);
				setError("");
				const blocked = wait && result.state?.status === "ACTIVE";
				onState({ slideId, blocked });
				if (result.state?.status === "ACTIVE" || (winner && result.state?.status === "LOCKED")) timer = setTimeout(() => void read(winner ? "resolve" : "status"), 2000);
			} catch {
				if (active) {
					setBusy(false);
					setError("Twitch could not be reached. Retry or skip this interaction.");
					onState({ slideId, blocked: wait });
				}
			}
		}
		void read(winner ? "resolve" : "start");
		return () => {
			active = false;
			clearTimeout(timer);
		};
	}, [eventId, secret, slideId, wait, winner, onState, attempt]);
	useEffect(() => {
		if (!state) return;
		const tick = () => setSeconds(Math.max(0, Math.ceil((Date.parse(state.endsAt) - Date.now()) / 1000)));
		tick();
		const timer = setInterval(tick, 1000);
		return () => clearInterval(timer);
	}, [state]);
	async function skip() {
		setBusy(true);
		try {
			const result = await eventInteractionAction(eventId, secret, slideId, "skip");
			if (!result.ok) {
				setError("This interaction could not be skipped. Retry.");
				return;
			}
			setState(result.state);
			setError("");
			onState({ slideId, blocked: false });
		} catch {
			setError("This interaction could not be skipped. Retry.");
		} finally {
			setBusy(false);
		}
	}
	return (
		<div className='flex flex-wrap items-center justify-center gap-2 text-sm text-muted' aria-live='polite'>
			{busy ? <Spinner size='sm' aria-label='Starting Twitch interaction' /> : null}
			{error ? (
				<>
					<p role='alert' className='max-w-sm text-danger'>
						{error}
					</p>
					<Button
						size='sm'
						variant='secondary'
						isDisabled={busy}
						onPress={() => {
							setBusy(true);
							setAttempt((value) => value + 1);
						}}
					>
						Retry Twitch
					</Button>
					<Button size='sm' variant='tertiary' isDisabled={busy} onPress={() => void skip()}>
						Skip interaction
					</Button>
				</>
			) : state ? (
				<p>
					{type === "poll" ? "Twitch poll" : "Channel Points prediction"} {state.status === "ACTIVE" ? `running. ${seconds}s remaining.` : state.status === "SKIPPED" ? (state.manualCheck ? "skipped. Check Twitch manually: cancellation could not be confirmed." : "skipped.") : state.status === "LOCKED" ? "locked." : state.status === "CANCELED" ? "canceled. Channel Points are refunded." : "complete."}
				</p>
			) : null}
		</div>
	);
}
