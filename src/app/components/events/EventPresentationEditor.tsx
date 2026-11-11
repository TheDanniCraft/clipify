"use client";
import { useEffect, useState } from "react";
import { Button, Link, Spinner } from "@heroui/react";
import { createEventPreviewAction, getEventPreviewAction } from "@actions/events";
import type { EventConfiguration } from "@lib/eventConfiguration";
import EventPresenter, { type AwardShow } from "./EventPresenter";
import EventDeckEditor from "./EventDeckEditor";
export default function EventPresentationEditor({ creatorId, eventId, draft, busy, onChange }: { creatorId: string; eventId: string; draft: EventConfiguration; busy: boolean; onChange: (slides: EventConfiguration["slides"]) => void }) {
	const [show, setShow] = useState<Extract<Awaited<ReturnType<typeof getEventPreviewAction>>, { ok: true }> | null>(null),
		[token, setToken] = useState(""),
		[error, setError] = useState(""),
		[attempt, setAttempt] = useState(0),
		[copied, setCopied] = useState(false);
	useEffect(() => {
		let active = true;
		void (async () => {
			try {
				const link = await createEventPreviewAction(creatorId, eventId);
				if (!link.ok) throw new Error("Preview unavailable");
				const result = await getEventPreviewAction(eventId, link.token);
				if (!result.ok) throw new Error("Preview unavailable");
				if (active) {
					setShow(result);
					setToken(link.token);
					setError("");
				}
			} catch {
				if (active) setError("The preview could not load. Please retry.");
			}
		})();
		return () => {
			active = false;
		};
	}, [creatorId, eventId, attempt]);
	const url = token ? `/events/${eventId}/preview#${token}` : "";
	const preview: AwardShow | null = show
		? {
				...show,
				event: {
					...show.event,
					title: draft.title,
					description: draft.description,
					whiteLabel: draft.whiteLabel,
					slides: draft.slides,
					presentation: draft.presentation,
					categories: draft.categories.map((category) => ({ ...category, presenterMode: category.presenterMode ?? (category.selection === "data" ? "winner" : "nominees"), candidates: show.event.categories.find((item) => item.id === category.id)?.candidates ?? [], results: show.event.categories.find((item) => item.id === category.id)?.results, dataResult: show.event.categories.find((item) => item.id === category.id)?.dataResult })),
				},
			}
		: null;
	return (
		<div className='space-y-5'>
			<div className='flex flex-wrap items-center justify-between gap-3'>
				<div>
					<h2 className='font-semibold'>Presentation</h2>
					<p className='mt-1 text-sm text-muted'>Arrange your slides and preview the show. Save changes to update the shared preview.</p>
				</div>
				{url ? (
					<div className='flex flex-wrap items-center gap-2'>
						<Link href={url} target='_blank' rel='noopener noreferrer'>
							Open preview
						</Link>
						<Button
							size='sm'
							variant='secondary'
							onPress={async () => {
								try {
									await navigator.clipboard.writeText(new URL(url, window.location.origin).toString());
									setCopied(true);
								} catch {
									setError("The link could not be copied. Open the preview and copy its address.");
								}
							}}
						>
							{copied ? "Preview link copied" : "Copy preview link"}
						</Button>
					</div>
				) : null}
			</div>
			{error ? (
				<div className='flex flex-wrap items-center gap-3'>
					<p role='alert' className='text-sm text-danger'>
						{error}
					</p>
					<Button variant='secondary' size='sm' onPress={() => setAttempt((value) => value + 1)}>
						Retry preview
					</Button>
				</div>
			) : null}
			<EventDeckEditor
				value={draft.slides}
				categories={draft.categories}
				nomineeCounts={show?.nomineeCounts}
				readOnly={busy}
				onChange={onChange}
				preview={(slideId) => (
					<div className='overflow-hidden rounded-xl border border-separator' aria-label='Live presentation preview'>
						{preview ? (
							<EventPresenter key={slideId ?? "welcome"} eventId={eventId} preview initial={preview} initialSlideId={slideId} embedded />
						) : (
							<div role='status' className='flex min-h-80 items-center justify-center gap-2 text-sm text-muted'>
								<Spinner size='sm' />
								Loading preview…
							</div>
						)}
					</div>
				)}
			/>
		</div>
	);
}
