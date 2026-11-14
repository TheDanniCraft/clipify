"use client";
import { useEffect, useState } from "react";
import { Button, Spinner } from "@heroui/react";
import { authClient } from "@/auth/client";
import { getEventTwitchConnectionAction } from "@actions/events";
import { notify } from "@lib/toast";
export default function EventTwitchConnection({ creatorId, eventId, beforeConnect }: { creatorId: string; eventId: string; beforeConnect?: () => Promise<boolean> }) {
	const [status, setStatus] = useState<{ poll: boolean; prediction: boolean; canAuthorize: boolean } | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState(false);
	const [attempt, setAttempt] = useState(0);
	useEffect(() => {
		let active = true;
		getEventTwitchConnectionAction(creatorId)
			.then((result) => {
				if (!active) return;
				if (result.ok) {
					setStatus(result);
					setError(false);
				} else setError(true);
			})
			.catch(() => {
				if (active) setError(true);
			});
		return () => {
			active = false;
		};
	}, [creatorId, attempt]);
	async function connect(type: "poll" | "prediction") {
		setBusy(true);
		try {
			if (beforeConnect && !(await beforeConnect())) return;
			const result = await getEventTwitchConnectionAction(creatorId, type, eventId);
			if (!result.ok || !("link" in result) || !result.link) {
				notify({ title: "The channel owner needs to connect this Twitch permission.", color: "danger" });
				return;
			}
			const linked = await authClient.linkSocial(result.link);
			if (linked.error) notify({ title: "Twitch could not be connected. Try again.", color: "danger" });
		} catch {
			notify({ title: "Twitch could not be connected. Try again.", color: "danger" });
		} finally {
			setBusy(false);
		}
	}
	return (
		<div className='space-y-3 border-t border-separator pt-5'>
			<h3 className='font-semibold'>Twitch interactions</h3>
			<p className='text-sm text-muted'>Connect access here, then choose an interaction on each category slide.</p>
			{!status && !error ? <Spinner aria-label='Loading Twitch permissions' size='sm' /> : null}
			{error ? (
				<Button variant='secondary' onPress={() => setAttempt((value) => value + 1)}>
					Retry Twitch permissions
				</Button>
			) : null}
			{status ? (
				<>
					{!status.canAuthorize && (!status.poll || !status.prediction) ? <p className='text-sm text-muted'>The channel owner can grant additional Twitch access from their account.</p> : null}
					<div className='flex flex-wrap gap-3'>
						{(["poll", "prediction"] as const).map((type) => (
							<Button key={type} variant='secondary' isDisabled={busy || !status.canAuthorize} isPending={busy} onPress={() => void connect(type)}>
								{status[type] ? "Reconnect" : "Connect"} Twitch {type === "poll" ? "polls" : "predictions"}
							</Button>
						))}
					</div>
					<p className='text-sm text-muted'>
						Polls {status.poll ? "connected" : "not connected"}. Predictions {status.prediction ? "connected" : "not connected"}.
					</p>
				</>
			) : null}
		</div>
	);
}
