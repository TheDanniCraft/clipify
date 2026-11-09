"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Button, ComboBox, Input, Label, ListBox, TextArea, TextField } from "@heroui/react";
import { searchEventSourcesAction, submitEventAction, searchEventTeamSourcesAction, addEventTeamCandidateAction } from "@actions/events";
import { EventSelect, EventText } from "./EventFields";
import type { PublicAwardEvent } from "@lib/eventPublicView";
import type { EventCandidateContent } from "@lib/eventCandidates";
import EventUploadForm from "./EventUploadForm";
type Category = PublicAwardEvent["categories"][number];
export default function EventSubmissionForm(props: { eventId: string; category: Category; onSubmitted: () => void; teamCreatorId?: string }) {
	const kind = props.category.source;
	return kind === "image" || kind === "video" || kind === "audio" ? <EventUploadForm eventId={props.eventId} categoryId={props.category.id} kind={kind} team={!!props.teamCreatorId} onSubmitted={props.onSubmitted} /> : <SourceSubmissionForm {...props} />;
}
function SourceSubmissionForm({ eventId, category, onSubmitted, teamCreatorId }: { eventId: string; category: Category; onSubmitted: () => void; teamCreatorId?: string }) {
	const [query, setQuery] = useState(""),
		[reference, setReference] = useState(""),
		[title, setTitle] = useState(""),
		[description, setDescription] = useState(""),
		[items, setItems] = useState<EventCandidateContent[]>([]),
		[busy, setBusy] = useState(false),
		[loading, setLoading] = useState(false),
		[error, setError] = useState(""),
		[message, setMessage] = useState("");
	const searchable = ["clip", "youtube", "game"].includes(category.source);
	useEffect(() => {
		if (!searchable) return;
		let active = true;
		const timer = setTimeout(() => {
			setLoading(true);
			void (teamCreatorId ? searchEventTeamSourcesAction(teamCreatorId, eventId, category.id, query) : searchEventSourcesAction(eventId, category.id, query))
				.then((result) => {
					if (!active) return;
					if (result.ok) {
						setItems(result.items);
						setError("");
					} else {
						setItems([]);
						setError("No matching item was found within this category's rules. Try another search or link.");
					}
				})
				.catch(() => {
					if (active) setError("Search is unavailable. Please try again.");
				})
				.finally(() => {
					if (active) setLoading(false);
				});
		}, 250);
		return () => {
			active = false;
			clearTimeout(timer);
		};
	}, [eventId, category.id, query, searchable, teamCreatorId]);
	async function submit() {
		setBusy(true);
		setError("");
		setMessage("");
		try {
			const result = await (teamCreatorId ? addEventTeamCandidateAction(teamCreatorId, eventId, category.id, { reference, title, description }) : submitEventAction(eventId, category.id, { reference, title, description }));
			if (!result.ok) {
				setError(result.code === "LIMIT_REACHED" ? "You have reached this category's limit. Withdraw an earlier proposal to submit another." : result.code === "PHASE_CLOSED" ? "Nominations have closed." : "This proposal could not be submitted. Check the category rules and try again.");
				return;
			}
			setMessage(teamCreatorId ? "Candidate added." : "Your proposal was submitted.");
			setReference("");
			setTitle("");
			setDescription("");
			setQuery("");
			onSubmitted();
		} catch {
			setError("Your proposal could not be submitted. Your draft is preserved; please try again.");
		} finally {
			setBusy(false);
		}
	}
	return (
		<div className='space-y-4'>
			{searchable ? (
				<ComboBox
					aria-label={`Choose ${category.title}`}
					variant='secondary'
					inputValue={query}
					selectedKey={reference || null}
					onInputChange={(value) => {
						setQuery(value);
						setReference("");
					}}
					onSelectionChange={(key) => {
						const item = items.find((i) => i.reference === String(key));
						if (item) {
							setReference(item.reference);
							setTitle(item.title);
							setQuery(item.title);
						}
					}}
					defaultFilter={() => true}
				>
					<Label>{category.source === "clip" ? "Search clips or paste a Twitch clip link" : category.source === "youtube" ? "Search videos or paste a YouTube link" : "Search Twitch games"}</Label>
					<ComboBox.InputGroup>
						<Input variant='secondary' />
						<ComboBox.Trigger />
					</ComboBox.InputGroup>
					<ComboBox.Popover>
						<ListBox items={items.map((item) => ({ ...item, id: item.reference }))} renderEmptyState={() => (loading ? "Searching…" : "No eligible matches")}>
							{(item) => (
								<ListBox.Item id={item.id} textValue={item.title}>
									<div className='flex max-w-md items-center gap-3'>
										{item.thumbnailUrl ? <Image src={item.thumbnailUrl} unoptimized alt='' width={80} height={45} className='aspect-video rounded object-cover' /> : null}
										<div className='min-w-0'>
											<Label className='line-clamp-2'>{item.title}</Label>
											<p className='text-xs text-muted'>{item.views !== undefined ? `${new Intl.NumberFormat().format(item.views)} views` : item.kind === "game" ? "Twitch game" : ""}</p>
										</div>
									</div>
									<ListBox.ItemIndicator />
								</ListBox.Item>
							)}
						</ListBox>
					</ComboBox.Popover>
				</ComboBox>
			) : category.source === "choice" ? (
				<EventSelect label='Your choice' value={reference} onChange={setReference} options={category.options.map((option) => ({ id: option, label: option }))} />
			) : category.source === "text" ? (
				<EventText label='Proposal name' value={title} onChange={setTitle} />
			) : category.source === "person" ? (
				<EventText label='Twitch username' value={reference} onChange={setReference} />
			) : category.source === "link" ? (
				<>
					<EventText label='Link' value={reference} onChange={setReference} />
					<EventText label='Proposal name' value={title} onChange={setTitle} />
				</>
			) : (
				<p className='text-sm text-muted'>Uploads require connected event storage.</p>
			)}
			{["text", "link", "person"].includes(category.source) ? (
				<TextField>
					<Label>Description (optional)</Label>
					<TextArea variant='secondary' value={description} onChange={(e) => setDescription(e.target.value)} />
				</TextField>
			) : null}
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
			<Button isPending={busy} isDisabled={busy || (searchable && !reference)} onPress={() => void submit()}>
				{teamCreatorId ? "Add candidate" : "Submit proposal"}
			</Button>
		</div>
	);
}
