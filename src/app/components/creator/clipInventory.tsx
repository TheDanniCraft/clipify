"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Button, Card, Checkbox, Input, Label, ListBox, Modal, NumberField, Select, Table, TextField, Link } from "@heroui/react";
import { fromDate, toCalendarDate } from "@internationalized/date";
import { getCreatorClipInventory, getCreatorClipPreview, refreshCreatorLibrary } from "@actions/creatorLibrary";
import AppDateRangePicker, { type AppDateRange } from "@components/appDateRangePicker";
import AppPagination from "@components/appPagination";
import ControlledModal from "@components/controlledModal";
import LocalizedDate from "@components/localizedDate";
import ClipExport from "./clipExport";

type InventoryResult = Awaited<ReturnType<typeof getCreatorClipInventory>>;
type Clip = Extract<InventoryResult, { ok: true }>["items"][number];
const fields: Record<string, string> = { title: "Title", category: "Category", minViews: "Minimum views", minDuration: "Minimum duration", maxDuration: "Maximum duration", startedAt: "Start date", endedAt: "End date", page: "Page", pageSize: "Page size", timeZone: "Timezone" };

function restoredRange(query: Record<string, string>): AppDateRange | null {
	try {
		if (!query.startedAt || !query.endedAt || !Number.isFinite(Date.parse(query.startedAt)) || !Number.isFinite(Date.parse(query.endedAt))) return null;
		const timeZone = query.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
		return { start: toCalendarDate(fromDate(new Date(query.startedAt), timeZone)), end: toCalendarDate(fromDate(new Date(query.endedAt), timeZone)).subtract({ days: 1 }) };
	} catch {
		return null;
	}
}

export default function ClipInventory({ creatorId, query: initialQuery, data: initialData }: { creatorId: string; query: Record<string, string>; data: InventoryResult }) {
	const [view, setView] = useState({ query: initialQuery, data: initialData });
	const { query, data } = view;
	const requestEpoch = useRef(0);
	const path = usePathname();
	const fixedVideoId = path.startsWith("/dashboard/streams/") ? initialQuery.videoId : undefined;
	const [draft, setDraft] = useState(query);
	const [refresh, setRefresh] = useState<Awaited<ReturnType<typeof refreshCreatorLibrary>>>();
	const [pending, startTransition] = useTransition();
	const selectionScope = JSON.stringify([
		creatorId,
		path,
		Object.entries(query)
			.filter(([key]) => key !== "page")
			.sort(),
	]);
	const [selection, setSelection] = useState<{ scope: string; ids: Set<string>; cleared?: boolean }>({ scope: selectionScope, ids: new Set<string>() });
	const selected = selection.scope === selectionScope ? selection.ids : new Set<string>();
	const selectClip = (id: string, include: boolean) => {
		const ids = new Set(selected);
		if (include && ids.size < 50) ids.add(id);
		else if (!include) ids.delete(id);
		setSelection({ scope: selectionScope, ids });
	};
	const [preview, setPreview] = useState<Clip | null>(null);
	const [playbackUrl, setPlaybackUrl] = useState<string | null | undefined>();
	const timeZone = query.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
	const [range, setRange] = useState<AppDateRange | null>(() => restoredRange(query));
	useEffect(() => {
		if (!preview) return;
		let current = true;
		void getCreatorClipPreview({ creatorId, clipId: preview.id })
			.then((result) => {
				if (current) setPlaybackUrl(result?.playbackUrl ?? null);
			})
			.catch(() => {
				if (current) setPlaybackUrl(null);
			});
		return () => {
			current = false;
		};
	}, [creatorId, preview]);
	const navigate = useCallback(
		(next: Record<string, string>, push = true) => {
			if (fixedVideoId) next = { ...next, videoId: fixedVideoId };
			const epoch = ++requestEpoch.current;
			const nextScope = JSON.stringify([
				creatorId,
				path,
				Object.entries(next)
					.filter(([key]) => key !== "page")
					.sort(),
			]);
			setSelection((current) => (current.scope === nextScope ? current : { scope: nextScope, ids: new Set(), cleared: current.ids.size > 0 || current.cleared }));
			startTransition(async () => {
				const parsed: Record<string, unknown> = { ...next };
				for (const key of ["page", "pageSize", "minViews", "minDuration", "maxDuration"]) if (next[key] !== undefined) parsed[key] = Number(next[key]);
				let result: InventoryResult;
				try {
					result = await getCreatorClipInventory({ creatorId, query: parsed });
				} catch {
					result = { ok: false, code: "SERVICE_UNAVAILABLE" };
				}
				if (epoch !== requestEpoch.current) return;
				setView({ query: next, data: result });
				if (push) window.history.pushState(null, "", `${path}?${new URLSearchParams(next)}`);
			});
		},
		[creatorId, path, fixedVideoId],
	);
	useEffect(() => {
		const restore = () => {
			const next = Object.fromEntries(new URLSearchParams(window.location.search));
			setDraft(next);
			setRange(restoredRange(next));
			navigate(next, false);
		};
		window.addEventListener("popstate", restore);
		return () => {
			window.removeEventListener("popstate", restore);
			requestEpoch.current++;
		};
	}, [navigate]);
	const fieldErrors = !data.ok && "fieldErrors" in data ? data.fieldErrors : undefined;
	const update = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }));
	return (
		<div className='my-6 flex flex-col gap-5'>
			<Card>
				<Card.Content>
					<form
						className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
						onSubmit={(event) => {
							event.preventDefault();
							const next = Object.fromEntries(Object.entries(draft).filter(([, value]) => value !== ""));
							next.page = "1";
							next.timeZone = timeZone;
							if (range) {
								next.startedAt = range.start.toDate(timeZone).toISOString();
								next.endedAt = range.end.add({ days: 1 }).toDate(timeZone).toISOString();
							} else {
								delete next.startedAt;
								delete next.endedAt;
							}
							navigate(next);
						}}
					>
						<TextField value={draft.title ?? ""} onChange={(value) => update("title", value)}>
							<Label>Title</Label>
							<Input variant='secondary' placeholder='Search clip titles' />
						</TextField>
						<Select variant='secondary' aria-label='Category' selectedKey={draft.category || null} onSelectionChange={(key) => update("category", String(key ?? ""))}>
							<Label>Category</Label>
							<Select.Trigger>
								<Select.Value />
							</Select.Trigger>
							<Select.Popover>
								<ListBox>
									<ListBox.Item id='' textValue='All categories'>
										All categories
									</ListBox.Item>
									{data.ok
										? data.categories.map((category) => (
												<ListBox.Item key={category.id} id={category.id} textValue={category.name}>
													{category.name}
												</ListBox.Item>
											))
										: null}
								</ListBox>
							</Select.Popover>
						</Select>
						<Select variant='secondary' selectedKey={draft.sort ?? "newest"} onSelectionChange={(key) => update("sort", String(key ?? "newest"))}>
							<Label>Sort</Label>
							<Select.Trigger>
								<Select.Value />
							</Select.Trigger>
							<Select.Popover>
								<ListBox>
									<ListBox.Item id='newest' textValue='Newest'>
										Newest
									</ListBox.Item>
									<ListBox.Item id='most_viewed' textValue='Most viewed'>
										Most viewed
									</ListBox.Item>
								</ListBox>
							</Select.Popover>
						</Select>
						{["minViews", "minDuration", "maxDuration"].map((key) => (
							<NumberField variant='secondary' key={key} value={draft[key] ? Number(draft[key]) : undefined} onChange={(value) => update(key, Number.isNaN(value) ? "" : String(value))} minValue={0} isInvalid={Boolean(fieldErrors?.[key as keyof typeof fieldErrors])}>
								<Label>
									{fields[key]}
									{key.includes("Duration") ? " (seconds)" : ""}
								</Label>
								<NumberField.Group>
									<NumberField.DecrementButton />
									<NumberField.Input />
									<NumberField.IncrementButton />
								</NumberField.Group>
							</NumberField>
						))}
						<AppDateRangePicker label='Clip creation dates' value={range} onChange={setRange} variant='secondary' fullWidth />
						<div className='flex items-end gap-2'>
							<Button type='submit' isPending={pending}>
								Apply filters
							</Button>
							<Button
								variant='secondary'
								onPress={() => {
									setDraft({});
									setRange(null);
									navigate({});
								}}
							>
								Clear filters
							</Button>
						</div>
						<p className='text-xs text-muted sm:col-span-2 lg:col-span-3'>Dates use {timeZone}. Views are each clip’s current lifetime views.</p>
					</form>
				</Card.Content>
			</Card>
			{!data.ok ? (
				<div role='alert' aria-label={data.code === "INVALID_INPUT" ? "Filter validation" : "Inventory unavailable"} className='rounded-xl border border-danger p-4'>
					{fieldErrors ? (
						Object.entries(fieldErrors).map(([key, messages]) => (
							<p key={key} data-filter-error-field={key}>
								{fields[key] ?? "Filter"}: {messages?.join(" ")}
							</p>
						))
					) : (
						<p>{data.code === "SERVICE_UNAVAILABLE" ? "Your clips could not be loaded. Please try again." : "You don’t have access to this creator’s clips."}</p>
					)}
					<Button variant='secondary' onPress={() => navigate(query, false)} isPending={pending}>
						Retry
					</Button>
				</div>
			) : (
				<>
					<div className='flex flex-wrap items-center gap-3'>
						<Button
							variant='secondary'
							isPending={pending}
							onPress={() =>
								startTransition(async () => {
									try {
										const result = await refreshCreatorLibrary({ creatorId });
										setRefresh(result);
									} catch {
										setRefresh({ ok: false, code: "SERVICE_UNAVAILABLE" });
									}
								})
							}
						>
							Refresh library
						</Button>
						<Button variant='tertiary' isDisabled={pending} onPress={() => navigate(query, false)}>
							Reload clips
						</Button>
					</div>

					{refresh ? (
						<div role={refresh.ok ? "status" : "alert"} className='rounded-xl border border-default p-3 text-sm'>
							{refresh.ok ? (
								"Refresh requested. Reload clips to check for new results."
							) : refresh.code === "SYNC_COOLDOWN" ? (
								<>The library was refreshed recently. You can request another refresh {"nextAllowedAt" in refresh && refresh.nextAllowedAt ? <LocalizedDate value={refresh.nextAllowedAt} timeZone={timeZone} showTime /> : "later"}.</>
							) : refresh.code === "RECONNECT_REQUIRED" ? (
								<>
									Connect Twitch to load your clips.{" "}
									<Link href='/dashboard/settings' target='_blank' rel='noopener noreferrer'>
										Connect Twitch (opens in a new tab)
									</Link>
								</>
							) : (
								"The library could not be refreshed. Please try again."
							)}
						</div>
					) : null}
					<Card>
						<Card.Content className='flex flex-col gap-4'>
							<div className='flex flex-wrap items-center gap-3'>
								<Button
									variant='secondary'
									isDisabled={pending || selected.size >= 50}
									onPress={() => {
										const ids = new Set(selected);
										for (const clip of data.items) {
											if (ids.size < 50) ids.add(clip.id);
										}
										setSelection({ scope: selectionScope, ids });
									}}
								>
									Select page
								</Button>
								<Button variant='tertiary' isDisabled={selected.size === 0} onPress={() => setSelection({ scope: selectionScope, ids: new Set() })}>
									Clear selection
								</Button>
								<p role='status' aria-label='Clip selection'>
									{selected.size} selected
								</p>
								<p className='text-xs text-muted'>Select up to 50 clips across pages.</p>
								{selection.cleared ? <p role='status'>Selection cleared because the filters changed.</p> : null}
							</div>
							<ClipExport creatorId={creatorId} clipIds={[...selected]} scope={selection.scope} />
						</Card.Content>
					</Card>
					<div className='flex flex-wrap items-center justify-between gap-3'>
						<p role='status' aria-label='Inventory results'>
							{data.total} clips
						</p>
						<p className='text-sm text-muted'>
							{data.complete ? "Library synchronized" : "Showing known clips. Older clips may still be syncing."}
							{data.fetchedAt ? (
								<>
									{" "}
									Updated <LocalizedDate value={data.fetchedAt} timeZone={timeZone} showTime />
								</>
							) : null}
						</p>
					</div>
					{data.total === 0 ? (
						<Card>
							<Card.Content>
								<h2 className='font-semibold'>No clips found</h2>
								<p className='text-muted'>Try clearing your filters. Newly connected accounts may need time to sync clips.</p>
							</Card.Content>
						</Card>
					) : (
						<Table>
							<Table.ScrollContainer>
								<Table.Content aria-label='Clip inventory' className='min-w-[640px]'>
									<Table.Header>
										<Table.Column aria-label='Select clips'>Select</Table.Column>
										<Table.Column isRowHeader>Clip</Table.Column>
										<Table.Column>Category</Table.Column>
										<Table.Column>Created</Table.Column>
										<Table.Column>Duration</Table.Column>
										<Table.Column>Views</Table.Column>
										<Table.Column>Stream</Table.Column>
									</Table.Header>
									<Table.Body>
										{data.items.map((clip) => (
											<Table.Row key={clip.id} id={clip.id} data-clip-id={clip.id}>
												<Table.Cell>
													<Checkbox isSelected={selected.has(clip.id)} isDisabled={!selected.has(clip.id) && selected.size >= 50} onChange={(include) => selectClip(clip.id, include)}>
														<Checkbox.Content>
															<Checkbox.Control>
																<Checkbox.Indicator />
															</Checkbox.Control>
															<span className='sr-only'>Select {clip.title}</span>
														</Checkbox.Content>
													</Checkbox>
												</Table.Cell>
												<Table.Cell>
													<div className='flex items-center gap-3'>
														{clip.thumbnailUrl ? <img src={clip.thumbnailUrl} alt='' className='h-12 w-20 rounded-lg object-cover' /> : null}
														<Button
															variant='tertiary'
															aria-label={`Preview ${clip.title}`}
															onPress={() => {
																setPlaybackUrl(undefined);
																setPreview(clip);
															}}
														>
															{clip.title || "Untitled clip"}
														</Button>
													</div>
												</Table.Cell>
												<Table.Cell>{data.categories.find((category) => category.id === clip.categoryId)?.name ?? "Category unavailable"}</Table.Cell>
												<Table.Cell>
													<LocalizedDate value={clip.createdAt} timeZone={timeZone} showTime />
												</Table.Cell>
												<Table.Cell>{Math.round(clip.duration)}s</Table.Cell>
												<Table.Cell>{clip.views.toLocaleString()}</Table.Cell>
												<Table.Cell>{clip.videoId ? <Link href={`/dashboard/streams/${encodeURIComponent(clip.videoId)}`}>View stream</Link> : "Unassigned"}</Table.Cell>
											</Table.Row>
										))}
									</Table.Body>
								</Table.Content>
							</Table.ScrollContainer>
						</Table>
					)}
					<AppPagination page={Number(query.page) || 1} total={Math.ceil(data.total / (Number(query.pageSize) || 25))} onChange={(page) => navigate({ ...query, page: String(page) })} />
				</>
			)}
			<ControlledModal
				isOpen={Boolean(preview)}
				onClose={() => {
					setPreview(null);
					setPlaybackUrl(undefined);
				}}
				size='lg'
			>
				<Modal.Header>
					<Modal.Heading>{preview?.title}</Modal.Heading>
				</Modal.Header>
				<Modal.Body>
					{playbackUrl ? (
						<video src={playbackUrl} controls autoPlay playsInline className='aspect-video w-full rounded-lg bg-black' />
					) : playbackUrl === undefined ? (
						<p role='status'>Loading preview…</p>
					) : (
						<div role='alert'>
							<p>This preview is unavailable. You can still open the clip on Twitch.</p>
							<Button
								variant='secondary'
								onPress={() => {
									if (preview) {
										setPlaybackUrl(undefined);
										setPreview({ ...preview });
									}
								}}
							>
								Retry preview
							</Button>
						</div>
					)}
					{preview ? (
						<Link href={preview.url} target='_blank' rel='noopener noreferrer'>
							Open on Twitch
						</Link>
					) : null}
				</Modal.Body>
			</ControlledModal>
		</div>
	);
}
