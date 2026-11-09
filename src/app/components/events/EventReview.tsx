"use client";
import { useCallback, useEffect, useState } from "react";
import { Button, Checkbox, Modal, Table } from "@heroui/react";
import ControlledModal from "@components/controlledModal";
import { getEventReviewAction, nominateEventCandidatesAction, groupEventCandidatesAction, releaseEventReviewAction } from "@actions/events";
import { EventSelect, EventText } from "./EventFields";
import { EventMedia } from "./EventMedia";
import type { EventCandidateContent } from "@lib/eventCandidates";
type ReviewData = Extract<Awaited<ReturnType<typeof getEventReviewAction>>, { ok: true }>;
export default function EventReview({ creatorId, eventId }: { creatorId: string; eventId: string }) {
	const [now, setNow] = useState(() => Date.now());
	const [data, setData] = useState<ReviewData | null>(null),
		[categoryId, setCategoryId] = useState(""),
		[filter, setFilter] = useState(""),
		[status, setStatus] = useState("all"),
		[selected, setSelected] = useState<string[]>([]),
		[expanded, setExpanded] = useState<string[]>([]),
		[busy, setBusy] = useState(false),
		[error, setError] = useState(""),
		[message, setMessage] = useState(""),
		[groupOpen, setGroupOpen] = useState(false),
		[groupTitle, setGroupTitle] = useState(""),
		[releaseOpen, setReleaseOpen] = useState(false),
		[opened, setOpened] = useState<EventCandidateContent | null>(null);
	const reload = useCallback(async () => {
		try {
			const result = await getEventReviewAction(creatorId, eventId);
			if (!result.ok) {
				setError("Proposals could not be loaded. Please retry.");
				return;
			}
			setData(result);
			setCategoryId((current) => current || result.event.configuration.categories.find((c) => c.selection !== "data")?.id || "");
		} catch {
			setError("Proposals could not be loaded. Please retry.");
		}
	}, [creatorId, eventId]);
	useEffect(() => {
		let active = true;
		void getEventReviewAction(creatorId, eventId)
			.then((result) => {
				if (!active) return;
				if (!result.ok) {
					setError("Proposals could not be loaded. Please retry.");
					return;
				}
				setData(result);
				setCategoryId((current) => current || result.event.configuration.categories.find((c) => c.selection !== "data")?.id || "");
			})
			.catch(() => {
				if (active) setError("Proposals could not be loaded. Please retry.");
			});
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => {
			active = false;
			clearInterval(timer);
		};
	}, [creatorId, eventId]);
	const category = data?.event.configuration.categories.find((c) => c.id === categoryId);
	const rows = data?.candidates.filter((c) => c.categoryId === categoryId) ?? [];
	const top = rows.filter((c) => !c.parentId),
		visible = top.filter((c) => (!filter || c.content.title.toLocaleLowerCase().includes(filter.toLocaleLowerCase())) && (status === "all" || (status === "nominated" ? c.nominated : !c.nominated)));
	const schedule = data?.event.configuration.schedule;
	const locked = !data?.event.published || data.event.reviewReleased || (!!schedule && (now >= Date.parse(schedule.votingEnd) || (!schedule.reviewRequired && now >= Date.parse(schedule.votingStart))));
	async function nominate(include: boolean) {
		setBusy(true);
		setError("");
		setMessage("");
		try {
			const ids = include ? [...new Set([...top.filter((c) => c.nominated).map((c) => c.id), ...selected])] : top.filter((c) => c.nominated && !selected.includes(c.id)).map((c) => c.id);
			const result = await nominateEventCandidatesAction(creatorId, eventId, categoryId, ids);
			if (!result.ok) {
				setError(result.code === "LIMIT_REACHED" ? "This category has reached its nominee limit. Remove a nomination first." : "Nominations could not be saved. Voting may have started; refresh and try again.");
				return;
			}
			setSelected([]);
			await reload();
			setMessage("Nominations saved.");
		} catch {
			setError("Nominations could not be saved. Your selection is preserved.");
		} finally {
			setBusy(false);
		}
	}
	async function group() {
		setBusy(true);
		setError("");
		try {
			const result = await groupEventCandidatesAction(creatorId, eventId, categoryId, selected, groupTitle);
			if (!result.ok) {
				setError("These proposals could not be grouped. Select at least two ungrouped proposals and enter a title.");
				return;
			}
			setGroupOpen(false);
			setGroupTitle("");
			setSelected([]);
			await reload();
			setMessage("Proposals grouped. You can now nominate the group.");
		} catch {
			setError("Grouping failed. Your title and selection are preserved.");
		} finally {
			setBusy(false);
		}
	}
	async function release() {
		setBusy(true);
		setError("");
		try {
			const result = await releaseEventReviewAction(creatorId, eventId);
			if (!result.ok) {
				setError("Review cannot be completed yet. Submissions must be closed and voting must not have ended.");
				return;
			}
			setReleaseOpen(false);
			await reload();
			setMessage("Review completed. Voting follows your roadmap.");
		} catch {
			setError("Review could not be completed. Please retry.");
		} finally {
			setBusy(false);
		}
	}
	return (
		<div className='space-y-5'>
			<div className='flex flex-wrap items-center justify-between gap-3'>
				<div>
					<h2 className='font-semibold'>Review proposals</h2>
					<p className='mt-1 text-sm text-muted'>Choose the nominees your community will vote for.</p>
				</div>
				<Button variant='secondary' isDisabled={busy} onPress={() => void reload()}>
					Refresh proposals
				</Button>
			</div>
			{error && !groupOpen && !releaseOpen ? (
				<p role='alert' className='text-sm text-danger'>
					{error}
				</p>
			) : null}
			{message ? (
				<p role='status' className='text-sm text-success'>
					{message}
				</p>
			) : null}
			{!data ? (
				<p role='status'>Loading proposals…</p>
			) : (
				<>
					<div className='grid gap-4 sm:grid-cols-3'>
						<EventSelect
							label='Review category'
							value={categoryId}
							onChange={(id) => {
								setCategoryId(id);
								setSelected([]);
								setExpanded([]);
							}}
							options={data.event.configuration.categories.filter((c) => c.selection !== "data").map((c) => ({ id: c.id, label: c.title }))}
						/>
						<EventText label='Search proposals' value={filter} onChange={setFilter} />
						<EventSelect
							label='Nomination status'
							value={status}
							onChange={setStatus}
							options={[
								{ id: "all", label: "All proposals" },
								{ id: "nominated", label: "Nominated" },
								{ id: "pending", label: "Not nominated" },
							]}
						/>
					</div>
					<div className='flex flex-wrap items-center gap-2'>
						<Button isDisabled={busy || locked || !selected.length} onPress={() => void nominate(true)}>
							Nominate selected
						</Button>
						<Button variant='secondary' isDisabled={busy || locked || !selected.length} onPress={() => void nominate(false)}>
							Remove nomination
						</Button>
						{category && ["text", "link"].includes(category.source) ? (
							<Button
								variant='secondary'
								isDisabled={busy || locked || selected.length < 2 || selected.some((id) => rows.find((c) => c.id === id)?.canonicalKey.startsWith("group:"))}
								onPress={() => {
									setError("");
									setGroupOpen(true);
								}}
							>
								Group selected
							</Button>
						) : null}
						<p className='text-sm text-muted'>
							{top.filter((c) => c.nominated).length} nominated{category?.nomineeLimit !== null && category?.nomineeLimit !== undefined ? ` of ${category.nomineeLimit}` : ""}
						</p>
					</div>
					<Table>
						<Table.ScrollContainer>
							<Table.Content aria-label='Award proposals' selectionMode='multiple' selectedKeys={new Set(selected)} disabledKeys={busy || locked ? visible.map((c) => c.id) : []} onSelectionChange={(keys) => setSelected(keys === "all" ? visible.map((c) => c.id) : [...keys].map(String))}>
								<Table.Header>
									<Table.Column>
										<Checkbox slot='selection' aria-label='Select all proposals'>
											<Checkbox.Content>
												<Checkbox.Control>
													<Checkbox.Indicator />
												</Checkbox.Control>
											</Checkbox.Content>
										</Checkbox>
									</Table.Column>
									<Table.Column isRowHeader>Proposal</Table.Column>
									<Table.Column>Status</Table.Column>
									<Table.Column>Preview</Table.Column>
								</Table.Header>
								<Table.Body renderEmptyState={() => "No proposals match this category."}>
									{visible.map((candidate) => {
										const children = rows.filter((c) => c.parentId === candidate.id);
										const isExpanded = expanded.includes(candidate.id);
										return (
											<Table.Row key={candidate.id} id={candidate.id}>
												<Table.Cell>
													<Checkbox slot='selection' aria-label={`Select ${candidate.content.title}`}>
														<Checkbox.Content>
															<Checkbox.Control>
																<Checkbox.Indicator />
															</Checkbox.Control>
														</Checkbox.Content>
													</Checkbox>
												</Table.Cell>
												<Table.Cell>
													<p className='font-medium'>{candidate.content.title}</p>
													{children.length ? (
														<>
															<Button variant='tertiary' size='sm' aria-label={`${isExpanded ? "Hide" : "Show"} grouped proposals for ${candidate.content.title}`} onPress={() => setExpanded((current) => (isExpanded ? current.filter((id) => id !== candidate.id) : [...current, candidate.id]))}>
																{children.length} grouped proposals
															</Button>
															{isExpanded ? (
																<ul className='mt-2 space-y-2 border-l border-separator pl-4'>
																	{children.map((child) => (
																		<li key={child.id}>
																			<p>{child.content.title}</p>
																			{child.content.description ? <p className='text-sm text-muted'>{child.content.description}</p> : null}
																		</li>
																	))}
																</ul>
															) : null}
														</>
													) : candidate.content.description ? (
														<p className='line-clamp-2 text-sm text-muted'>{candidate.content.description}</p>
													) : null}
												</Table.Cell>
												<Table.Cell>{candidate.nominated ? "Nominated" : "Not nominated"}</Table.Cell>
												<Table.Cell>
													<Button variant='tertiary' size='sm' aria-label={`Preview ${candidate.content.title}`} onPress={() => setOpened(candidate.content)}>
														Preview
													</Button>
												</Table.Cell>
											</Table.Row>
										);
									})}
								</Table.Body>
							</Table.Content>
						</Table.ScrollContainer>
					</Table>
					{schedule?.reviewRequired && !data.event.reviewReleased ? (
						<div className='flex flex-wrap items-center justify-between gap-3 border-t border-separator pt-5'>
							<p className='max-w-xl text-sm text-muted'>Complete every category before finishing review. Nominees cannot change once review is complete.</p>
							<Button
								isDisabled={busy || locked || now < Date.parse(schedule.submissionsEnd)}
								onPress={() => {
									setError("");
									setReleaseOpen(true);
								}}
							>
								Finish review
							</Button>
						</div>
					) : null}
				</>
			)}
			<ControlledModal isOpen={groupOpen} onOpenChange={setGroupOpen} ariaLabel='Group proposals'>
				<Modal.Header>
					<Modal.Heading>Group proposals</Modal.Heading>
				</Modal.Header>
				<Modal.Body className='space-y-4'>
					{error ? (
						<p role='alert' className='text-sm text-danger'>
							{error}
						</p>
					) : null}
					<p className='text-sm text-muted'>Viewers and the presenter see this title. Original proposals remain in the team view and each viewer’s own proposals.</p>
					<EventText label='Presentation title' value={groupTitle} onChange={setGroupTitle} />
				</Modal.Body>
				<Modal.Footer>
					<Button variant='secondary' isDisabled={busy} onPress={() => setGroupOpen(false)}>
						Cancel
					</Button>
					<Button isPending={busy} onPress={() => void group()}>
						Create group
					</Button>
				</Modal.Footer>
			</ControlledModal>
			<ControlledModal isOpen={releaseOpen} onOpenChange={setReleaseOpen} ariaLabel='Finish award review'>
				<Modal.Header>
					<Modal.Heading>Finish review?</Modal.Heading>
				</Modal.Header>
				<Modal.Body>
					{error ? (
						<p role='alert' className='text-sm text-danger'>
							{error}
						</p>
					) : null}
					<p>Voting will open at the planned time, or immediately if that time has passed. Nominees will be locked.</p>
				</Modal.Body>
				<Modal.Footer>
					<Button variant='secondary' isDisabled={busy} onPress={() => setReleaseOpen(false)}>
						Keep reviewing
					</Button>
					<Button isPending={busy} onPress={() => void release()}>
						Confirm nominees
					</Button>
				</Modal.Footer>
			</ControlledModal>
			<ControlledModal
				isOpen={!!opened}
				onOpenChange={(open) => {
					if (!open) setOpened(null);
				}}
				ariaLabel={opened?.title}
				size='lg'
			>
				<Modal.Body>{opened ? <EventMedia content={opened} /> : null}</Modal.Body>
			</ControlledModal>
		</div>
	);
}
