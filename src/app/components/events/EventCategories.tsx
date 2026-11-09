"use client";
import { EventDateTimeField } from "./EventRoadmap";
import { useState } from "react";
import { Button, Label, Modal, Switch, TextArea, TextField } from "@heroui/react";
import ControlledModal from "@components/controlledModal";
import { EventText, EventSelect, EventNumber } from "./EventFields";
import { categorySchema, type EventCategory } from "@lib/eventConfiguration";
const sources = [
	{ id: "clip", label: "Twitch clip" },
	{ id: "youtube", label: "YouTube video" },
	{ id: "image", label: "Image upload" },
	{ id: "video", label: "Video upload" },
	{ id: "audio", label: "Audio upload" },
	{ id: "text", label: "Text and description" },
	{ id: "link", label: "Link" },
	{ id: "person", label: "Twitch person" },
	{ id: "game", label: "Game" },
	{ id: "choice", label: "Preset choices" },
];
export default function EventCategories({ value, onChange, readOnly = false, timezone }: { value: EventCategory[]; onChange: (value: EventCategory[]) => void; readOnly?: boolean; timezone: string }) {
	const [edit, setEdit] = useState<EventCategory | null>(null),
		[error, setError] = useState("");
	const patch = (change: Partial<EventCategory>) => {
		if (edit) setEdit({ ...edit, ...change });
	};
	function apply() {
		const parsed = categorySchema.safeParse(edit);
		if (!parsed.success) {
			setError(parsed.error.issues[0]?.message ?? "Check the category settings.");
			return;
		}
		onChange(value.some((c) => c.id === parsed.data.id) ? value.map((c) => (c.id === parsed.data.id ? parsed.data : c)) : [...value, parsed.data]);
		setEdit(null);
		setError("");
	}
	return (
		<div className='space-y-4'>
			<div className='flex flex-wrap items-center justify-between gap-3'>
				<p className='text-sm text-muted'>Choose what your community can submit and how each winner is decided.</p>
				{!readOnly ? (
					<Button
						variant='secondary'
						onPress={() => {
							setError("");
							setEdit({ id: crypto.randomUUID(), title: "", group: "", source: "clip", selection: "audience", submissionLimit: 1, nomineeLimit: 6, rules: {}, options: [] });
						}}
					>
						Add category
					</Button>
				) : null}
			</div>
			{value.map((category, index) => (
				<div key={category.id} className='flex flex-wrap items-center justify-between gap-3 rounded-xl bg-default/40 p-4'>
					<div>
						<p className='font-medium'>{category.title}</p>
						<p className='text-sm text-muted'>
							{category.group ? `${category.group}: ` : ""}
							{sources.find((s) => s.id === category.source)?.label} / {category.selection === "data" ? "Data or team result" : category.selection === "team" ? "Team candidates" : "Viewer nominations"}
						</p>
					</div>
					{!readOnly ? (
						<div className='flex gap-2'>
							<Button
								size='sm'
								variant='tertiary'
								aria-label={`Move ${category.title} up`}
								isDisabled={index === 0}
								onPress={() => {
									const next = [...value];
									[next[index - 1], next[index]] = [next[index], next[index - 1]];
									onChange(next);
								}}
							>
								↑
							</Button>
							<Button
								size='sm'
								variant='secondary'
								onPress={() => {
									setError("");
									setEdit(category);
								}}
							>
								Edit {category.title}
							</Button>
							<Button size='sm' variant='tertiary' onPress={() => onChange(value.filter((c) => c.id !== category.id))}>
								Remove
							</Button>
						</div>
					) : null}
				</div>
			))}
			<ControlledModal
				isOpen={!!edit}
				onOpenChange={(open) => {
					if (!open) setEdit(null);
				}}
				size='lg'
				ariaLabel='Category settings'
			>
				<Modal.Header>
					<Modal.Heading>Category settings</Modal.Heading>
				</Modal.Header>
				<Modal.Body>
					{edit ? (
						<div className='space-y-5'>
							<EventText label='Category title' value={edit.title} onChange={(title) => patch({ title })} />
							<EventText label='Category group' value={edit.group} onChange={(group) => patch({ group })} />
							<div className='grid gap-4 sm:grid-cols-2'>
								<EventSelect label='Submission type' value={edit.source} options={sources} onChange={(source) => patch({ source: source as EventCategory["source"] })} />
								<EventSelect
									label='Candidates'
									value={edit.selection}
									options={[
										{ id: "audience", label: "Viewer submissions and voting" },
										{ id: "team", label: "Team candidates and viewer voting" },
										{ id: "data", label: "Data or team result, no voting" },
									]}
									onChange={(selection) => patch({ selection: selection as EventCategory["selection"] })}
								/>
							</div>
							{["image", "audio", "video"].includes(edit.source) ? <p className='text-sm text-muted'>Connect Google Drive or S3 storage before publishing this category.</p> : null}
							{edit.source === "youtube" ? <p className='text-sm text-muted'>Connect the host’s YouTube channel in Connections so viewers can find its videos.</p> : null}
							{edit.source === "choice" ? (
								<TextField>
									<Label>Choices, one per line</Label>
									<TextArea variant='secondary' value={edit.options.join("\n")} onChange={(e) => patch({ options: e.target.value.split("\n") })} />
								</TextField>
							) : null}
							<Switch isSelected={edit.submissionLimit === null} onChange={(unlimited) => patch({ submissionLimit: unlimited ? null : 1 })}>
								<Switch.Content>
									<Switch.Control>
										<Switch.Thumb />
									</Switch.Control>
									<Label>Unlimited submissions per viewer</Label>
								</Switch.Content>
							</Switch>
							<div className='grid gap-4 sm:grid-cols-2'>
								{edit.submissionLimit !== null ? <EventNumber label='Submissions per viewer' min={1} value={edit.submissionLimit} onChange={(submissionLimit) => patch({ submissionLimit })} /> : null}
								<EventNumber label='Maximum nominees' min={1} max={1000} value={edit.nomineeLimit ?? 6} onChange={(nomineeLimit) => patch({ nomineeLimit })} />
							</div>
							{["clip", "youtube"].includes(edit.source) ? (
								<div className='space-y-4 border-t border-separator pt-4'>
									<h3 className='font-medium'>Source conditions</h3>
									<EventDateTimeField label='Created on or after' value={edit.rules.startedAt ?? ""} timezone={timezone} onChange={(startedAt) => patch({ rules: { ...edit.rules, startedAt: startedAt || undefined } })} />
									<EventDateTimeField label='Created before' value={edit.rules.endedAt ?? ""} timezone={timezone} onChange={(endedAt) => patch({ rules: { ...edit.rules, endedAt: endedAt || undefined } })} />
									<div className='grid gap-4 sm:grid-cols-2'>
										<EventNumber label='Minimum duration (seconds)' value={edit.rules.minDuration ?? 0} onChange={(minDuration) => patch({ rules: { ...edit.rules, minDuration } })} />
										<EventNumber label='Maximum duration (seconds)' min={1} value={edit.rules.maxDuration ?? 600} onChange={(maxDuration) => patch({ rules: { ...edit.rules, maxDuration } })} />
									</div>
									<EventNumber label='Minimum views' value={edit.rules.minViews ?? 0} max={1000000000} onChange={(minViews) => patch({ rules: { ...edit.rules, minViews } })} />
									<EventText label='Title contains' value={edit.rules.titleIncludes ?? ""} onChange={(titleIncludes) => patch({ rules: { ...edit.rules, titleIncludes } })} />
									<EventText label='Title excludes' value={edit.rules.titleExcludes ?? ""} onChange={(titleExcludes) => patch({ rules: { ...edit.rules, titleExcludes } })} />
								</div>
							) : null}
							{edit.selection === "data" ? (
								<div className='space-y-4'>
									<p className='text-sm text-muted'>Hidden from nominations and voting. Enter a result for manually awarded categories.</p>
									<EventText label='Manual winner' value={edit.manualResult?.title ?? ""} onChange={(title) => patch({ manualResult: title ? { title, description: edit.manualResult?.description ?? "" } : undefined })} />
									{edit.manualResult ? <EventText label='Result description' value={edit.manualResult.description} onChange={(description) => patch({ manualResult: { ...edit.manualResult!, description } })} /> : null}
								</div>
							) : null}
							{error ? (
								<p role='alert' className='text-sm text-danger'>
									{error}
								</p>
							) : null}
						</div>
					) : null}
				</Modal.Body>
				<Modal.Footer>
					<Button variant='tertiary' onPress={() => setEdit(null)}>
						Cancel
					</Button>
					<Button onPress={apply}>Apply category</Button>
				</Modal.Footer>
			</ControlledModal>
		</div>
	);
}
