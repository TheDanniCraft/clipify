"use client";
import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { getEventTiesAction, chooseEventTieWinnerAction } from "@actions/events";
import { EventSelect } from "./EventFields";
type Ties = Extract<Awaited<ReturnType<typeof getEventTiesAction>>, { ok: true }>;
export default function EventTieResults({ creatorId, eventId, locked = false }: { creatorId: string; eventId: string; locked?: boolean }) {
	const [data, setData] = useState<Ties | null>(null),
		[error, setError] = useState(""),
		[busy, setBusy] = useState(false),
		[attempt, setAttempt] = useState(0);
	useEffect(() => {
		let active = true;
		getEventTiesAction(creatorId, eventId)
			.then((result) => {
				if (!active) return;
				if (result.ok) {
					setData(result);
					setError("");
				} else setError(result.code === "PHASE_CLOSED" ? "Ties can be decided after voting closes." : "Tie decisions could not load. Try again.");
			})
			.catch(() => {
				if (active) setError("Tie decisions could not load. Try again.");
			});
		return () => {
			active = false;
		};
	}, [creatorId, eventId, attempt]);
	async function choose(categoryId: string, candidateId: string) {
		setBusy(true);
		setError("");
		try {
			const result = await chooseEventTieWinnerAction(creatorId, eventId, categoryId, candidateId);
			if (result.ok) setData((current) => (current ? { ...current, categories: current.categories.map((category) => (category.id === categoryId ? { ...category, winnerId: candidateId } : category)) } : current));
			else setError("This choice could not be saved. Check that voting has closed and results are still private, then retry.");
		} catch {
			setError("This choice could not be saved. Try again.");
		} finally {
			setBusy(false);
		}
	}
	return (
		<section aria-label='Tied awards' className='space-y-4 border-t border-separator pt-6'>
			<h2 className='font-semibold'>Tied awards</h2>
			<p className='text-sm text-muted'>Choose one winner from each tied leading group before publishing results.</p>
			{error ? (
				<div role='status' className='space-y-3'>
					<p className='text-sm text-muted'>{error}</p>
					<Button size='sm' variant='secondary' onPress={() => setAttempt((value) => value + 1)}>
						Reload ties
					</Button>
				</div>
			) : null}
			{data && !data.categories.length ? <p className='text-sm text-muted'>No tied awards need a decision.</p> : null}
			{data?.categories.map((category) => (
				<fieldset key={category.id} disabled={locked || busy}>
					<EventSelect label={`${category.title} winner`} value={category.winnerId ?? ""} options={category.candidates.map((candidate) => ({ id: candidate.id, label: `${candidate.title} (${candidate.votes} votes)` }))} onChange={(candidateId) => void choose(category.id, candidateId)} />
				</fieldset>
			))}
		</section>
	);
}
