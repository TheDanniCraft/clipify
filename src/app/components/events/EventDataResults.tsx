"use client";
import { useEffect, useState } from "react";
import { Button, Label, Modal, Switch, TextArea, TextField } from "@heroui/react";
import { getEventReviewAction, setEventDataResultAction } from "@actions/events";
import { EventNumber, EventSelect, EventText } from "./EventFields";
import { awardDataResultSchema, type AwardDataResult } from "@lib/eventResults";
import type { EventCategory } from "@lib/eventConfiguration";
import { EventMedia } from "./EventMedia";
import ControlledModal from "@components/controlledModal";
import LocalizedDate from "@components/localizedDate";
type ReviewData = Extract<Awaited<ReturnType<typeof getEventReviewAction>>, { ok: true }>;
export default function EventDataResults({ creatorId, eventId, resultsPublished = false }: { creatorId: string; eventId: string; resultsPublished?: boolean }) {
	const [data, setData] = useState<ReviewData | null>(null),
		[selected, setSelected] = useState(""),
		[error, setError] = useState("");
	useEffect(() => {
		let active = true;
		void getEventReviewAction(creatorId, eventId)
			.then((result) => {
				if (!active) return;
				if (result.ok) setData(result);
				else setError("Results could not be loaded. Reopen this tab to retry.");
			})
			.catch(() => {
				if (active) setError("Results could not be loaded. Reopen this tab to retry.");
			});
		return () => {
			active = false;
		};
	}, [creatorId, eventId]);
	const categories = data?.event.configuration.categories.filter((c) => c.selection === "data") ?? [],
		category = categories.find((c) => c.id === (selected || categories[0]?.id));
	return (
		<div className='space-y-5'>
			<div>
				<h2 className='font-semibold'>Data awards</h2>
				<p className='mt-1 text-sm text-muted'>These awards do not appear in public voting. Review their results before presenting the show.</p>
			</div>
			{error ? (
				<p role='alert' className='text-sm text-danger'>
					{error}
				</p>
			) : null}
			{!data && !error ? <p role='status'>Loading results…</p> : null}
			{data && !categories.length ? <p className='text-sm text-muted'>Save a data category in Categories to prepare its result here.</p> : null}
			{category && data ? (
				<>
					<EventSelect label='Data category' value={category.id} onChange={setSelected} options={categories.map((c) => ({ id: c.id, label: c.title }))} />
					<DataResultEditor key={category.id} creatorId={creatorId} eventId={eventId} category={category} initial={data.event.frozenResults?.[category.id]} published={data.event.published} locked={resultsPublished || !!data.event.resultsPublishedAt} onSaved={(result) => setData((current) => (current ? { ...current, event: { ...current.event, frozenResults: { ...current.event.frozenResults, [category.id]: result } } } : current))} />
				</>
			) : null}
		</div>
	);
}
function DataResultEditor({ creatorId, eventId, category, initial, published, locked, onSaved }: { creatorId: string; eventId: string; category: EventCategory; initial: unknown; published: boolean; locked: boolean; onSaved: (result: AwardDataResult) => void }) {
	const stored = awardDataResultSchema.safeParse(initial),
		ready = stored.success && stored.data.status === "ready" ? stored.data : null;
	const [title, setTitle] = useState(ready?.title ?? category.manualResult?.title ?? ""),
		[description, setDescription] = useState(ready?.description ?? category.manualResult?.description ?? ""),
		[includeValue, setIncludeValue] = useState(ready?.value !== undefined || category.manualResult?.value !== undefined),
		[value, setValue] = useState(ready?.value ?? category.manualResult?.value ?? 0),
		[reference, setReference] = useState(ready?.content?.reference ?? ""),
		[busy, setBusy] = useState(false),
		[error, setError] = useState(""),
		[message, setMessage] = useState(""),
		[preview, setPreview] = useState(false);
	async function save() {
		setBusy(true);
		setError("");
		setMessage("");
		try {
			const result = await setEventDataResultAction(creatorId, eventId, category.id, { title, description, ...(includeValue ? { value } : {}), ...(reference ? { reference } : {}) });
			if (!result.ok) {
				setError(result.code === "PHASE_CLOSED" ? "Results are already published. They can no longer be changed." : "Check the winner name, number and source rules, then try again.");
				return;
			}
			onSaved(result.result);
			setTitle(result.result.status === "ready" ? result.result.title : title);
			setMessage("Result saved.");
		} catch {
			setError("Your result could not be saved. Your draft is preserved; please retry.");
		} finally {
			setBusy(false);
		}
	}
	return (
		<div className='space-y-5'>
			{ready ? (
				<div className='rounded-xl border border-separator p-4'>
					<p className='font-medium'>{ready.title}</p>
					{ready.value !== undefined ? <p className='mt-1 text-2xl font-semibold'>{new Intl.NumberFormat().format(ready.value)}</p> : null}
					<p className='mt-2 text-sm text-muted'>
						{ready.source === "manual" ? "Entered by your team" : "Clipify snapshot"}: <LocalizedDate value={ready.asOf} showTime />
					</p>
					{ready.content ? (
						<Button variant='tertiary' onPress={() => setPreview(true)}>
							Preview winner
						</Button>
					) : null}
				</div>
			) : (
				<p className='text-sm text-warning'>No complete snapshot is available. Enter the result below.</p>
			)}
			{!published ? <p className='text-sm text-muted'>Publish your event to record a result. You can prepare an initial result in Categories.</p> : null}
			<fieldset disabled={busy || locked || !published} className='space-y-4'>
				<EventText label='Winner name' value={title} onChange={setTitle} />
				{["clip", "youtube", "link", "person", "game"].includes(category.source) ? <EventText label={category.source === "youtube" ? "YouTube video link (optional)" : category.source === "clip" ? "Twitch clip link (optional)" : "Source reference (optional)"} value={reference} onChange={setReference} /> : null}
				<TextField>
					<Label>Description (optional)</Label>
					<TextArea variant='secondary' aria-label='Description (optional)' value={description} onChange={(event) => setDescription(event.target.value)} />
				</TextField>
				<Switch aria-label='Include a number' isSelected={includeValue} onChange={setIncludeValue}>
					<Switch.Control>
						<Switch.Thumb />
					</Switch.Control>
					<Switch.Content>
						<Label>Include a number</Label>
					</Switch.Content>
				</Switch>
				{includeValue ? <EventNumber label='Result value' value={value} min={-1000000000} max={1000000000000} onChange={setValue} /> : null}
			</fieldset>
			{error ? (
				<p role='alert' className='text-sm text-danger'>
					{error}
				</p>
			) : null}
			{message ? (
				<p role='status' className='text-sm text-success'>
					{message}
				</p>
			) : null}
			<Button isPending={busy} isDisabled={busy || locked || !published} onPress={() => void save()}>
				Save result
			</Button>
			<ControlledModal isOpen={preview} onOpenChange={setPreview} ariaLabel={ready?.title} size='lg'>
				<Modal.Body>{ready?.content ? <EventMedia content={ready.content} /> : null}</Modal.Body>
			</ControlledModal>
		</div>
	);
}
