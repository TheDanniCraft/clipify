"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, Link, Modal, Tabs } from "@heroui/react";
import { getPublicEventAction, beginEventLoginAction, voteEventAction, withdrawEventSubmissionAction } from "@actions/events";
import CountdownTimer from "@components/countdownTimer";
import ControlledModal from "@components/controlledModal";
import type { CreatorBrand } from "@lib/overlayMetadata";
import type { EventCandidateContent } from "@lib/eventCandidates";
import EventRoadmap from "./EventRoadmap";
import EventProgress from "./EventProgress";
import EventSubmissionForm from "./EventSubmissionForm";
import { EventMedia, EventNomineeCard } from "./EventMedia";
type View = Extract<Awaited<ReturnType<typeof getPublicEventAction>>, { ok: true }>;
export default function PublicEventView({ initial, creatorName, brand }: { initial: View; creatorName: string; brand?: CreatorBrand | null }) {
	const [data, setData] = useState(initial),
		[error, setError] = useState(""),
		[busy, setBusy] = useState<string | null>(null),
		[opened, setOpened] = useState<EventCandidateContent | null>(null);
	const sequence = useRef(0);
	const reload = useCallback(async () => {
		const current = ++sequence.current;
		try {
			const result = await getPublicEventAction(initial.event.id);
			if (current === sequence.current && result.ok) setData(result);
		} catch {
			if (current === sequence.current) setError("The event could not be refreshed. Please retry.");
		}
	}, [initial.event.id]);
	useEffect(() => {
		const timer = setInterval(() => void reload(), 15000);
		return () => clearInterval(timer);
	}, [reload]);
	async function login() {
		setBusy("login");
		setError("");
		try {
			const result = await beginEventLoginAction(data.event.id);
			if (result.ok && result.url) window.location.assign(result.url);
			else setError("Twitch sign-in could not be started. Please try again.");
		} catch {
			setError("Twitch sign-in could not be started. Please try again.");
		} finally {
			setBusy(null);
		}
	}
	async function vote(categoryId: string, candidateId: string, selected: boolean) {
		if (busy) return;
		const previous = data.selection.filter((s) => s.categoryId === categoryId).map((s) => s.candidateId);
		const next = selected ? (data.event.votesPerCategory === 1 ? [candidateId] : [...previous, candidateId]) : previous.filter((id) => id !== candidateId);
		if (next.length > data.event.votesPerCategory) {
			setError(`Choose up to ${data.event.votesPerCategory} nominees per category.`);
			return;
		}
		setBusy(categoryId);
		setError("");
		try {
			const result = await voteEventAction(data.event.id, categoryId, next);
			if (!result.ok) setError(result.code === "PHASE_CLOSED" ? "Voting has ended. Your last saved selection is preserved." : "Your vote could not be saved. Please try again.");
			await reload();
		} catch {
			setError("Your vote could not be saved. Please try again.");
		} finally {
			setBusy(null);
		}
	}
	async function withdraw(id: string) {
		setBusy(id);
		setError("");
		try {
			const result = await withdrawEventSubmissionAction(data.event.id, id);
			if (!result.ok) setError("This proposal could not be withdrawn. Nominations may have closed.");
			await reload();
		} finally {
			setBusy(null);
		}
	}
	const event = data.event;
	const active = event.phase === "submissions" || event.phase === "voting";
	return (
		<main className='mx-auto min-h-screen w-full max-w-6xl space-y-7 px-4 py-8 sm:px-8' style={brand ? ({ "--color-accent": brand.themeAccentColor, fontFamily: `${brand.fontFamily}, sans-serif` } as React.CSSProperties) : undefined}>
			{brand?.fontSource === "google" ? <link rel='stylesheet' href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(brand.fontFamily)}:wght@400;700&display=swap`} /> : null}
			<header className='space-y-4'>
				<div className='flex flex-wrap items-center justify-between gap-3'>
					<p className='text-sm text-muted'>{creatorName}&apos;s community awards</p>
					{!event.whiteLabel ? (
						<Link href='/' className='text-sm'>
							Made with Clipify
						</Link>
					) : null}
				</div>
				<h1 className='break-words text-4xl font-bold sm:text-5xl'>{event.title}</h1>
				{event.description ? <p className='max-w-3xl whitespace-pre-wrap text-muted'>{event.description}</p> : null}
				<EventProgress phase={event.phase} review={event.schedule.reviewRequired} />
			</header>
			{event.phase === "announcement" ? (
				<Card>
					<Card.Content className='space-y-5 p-8 text-center'>
						<h2 className='text-2xl font-semibold'>Nominations open soon</h2>
						<CountdownTimer endAt={event.schedule.submissionsStart} size='lg' />
					</Card.Content>
				</Card>
			) : null}
			{event.phase === "review" ? (
				<Card>
					<Card.Content className='space-y-4 p-8 text-center'>
						<h2 className='text-2xl font-semibold'>Nominations have ended</h2>
						<p className='text-muted'>The team is preparing the nominees. Voting opens next.</p>
						<CountdownTimer endAt={event.schedule.votingStart} />
					</Card.Content>
				</Card>
			) : null}
			{event.phase === "closed" ? <p className='rounded-xl bg-surface p-5'>Voting has ended. Your selection is saved. Results will appear after the show.</p> : null}
			{active && !data.participating ? (
				<div className='flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface p-5'>
					<p>Sign in with Twitch to {event.phase === "submissions" ? "submit your proposals" : "vote for your favorites"}.</p>
					<Button isPending={busy === "login"} onPress={() => void login()}>
						Continue with Twitch
					</Button>
				</div>
			) : null}
			{error ? (
				<div role='alert' className='flex flex-wrap items-center gap-3 text-danger'>
					<p>{error}</p>
					<Button variant='secondary' onPress={() => void reload()}>
						Refresh event
					</Button>
				</div>
			) : null}
			<Tabs defaultSelectedKey='participate'>
				<Tabs.ListContainer>
					<Tabs.List aria-label='Award event'>
						<Tabs.Tab id='participate'>{event.phase === "results" ? "Results" : "Categories"}</Tabs.Tab>
						<Tabs.Tab id='schedule'>Schedule</Tabs.Tab>
						{data.participating ? <Tabs.Tab id='mine'>My proposals</Tabs.Tab> : null}
					</Tabs.List>
				</Tabs.ListContainer>
				<Tabs.Panel id='participate' className='space-y-8 pt-6'>
					{event.categories.map((category) => (
						<section key={category.id} className='space-y-4'>
							{category.group ? <p className='text-sm font-medium text-accent'>{category.group}</p> : null}
							<h2 className='text-2xl font-semibold'>{category.title}</h2>
							{event.phase === "submissions" && category.selection === "audience" && data.participating ? (
								<Card>
									<Card.Content className='space-y-4'>
										<p className='text-sm text-muted'>{category.submissionLimit === null ? "Unlimited proposals" : `Up to ${category.submissionLimit} active proposals per person`}</p>
										<EventSubmissionForm eventId={event.id} category={category} onSubmitted={() => void reload()} />
									</Card.Content>
								</Card>
							) : null}
							{event.phase === "voting" ? <p className='text-sm text-muted'>Choose up to {event.votesPerCategory}. Your selection saves automatically.</p> : null}
							{category.candidates.length ? (
								<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
									{category.candidates.map((candidate) => (
										<EventNomineeCard key={candidate.id} candidate={candidate} selected={data.selection.some((s) => s.categoryId === category.id && s.candidateId === candidate.id)} onOpen={() => setOpened(candidate.content)} disabled={!!busy} onSelect={event.phase === "voting" && data.participating ? (selected) => void vote(category.id, candidate.id, selected) : undefined} result={category.results?.find((r) => r.id === candidate.id)} />
									))}
								</div>
							) : event.phase === "voting" ? (
								<p className='text-sm text-muted'>No nominees in this category.</p>
							) : null}
							{category.dataResult?.status === "ready" ? (
								<div className='max-w-lg space-y-3'>
									{category.dataResult.value !== undefined ? <p className='text-2xl font-semibold'>{new Intl.NumberFormat().format(category.dataResult.value)}</p> : null}
									<EventNomineeCard
										candidate={{ id: category.id, content: category.dataResult.content ?? { kind: "text", title: category.dataResult.title, description: category.dataResult.description, reference: "" } }}
										onOpen={() => {
											const result = category.dataResult;
											if (result?.status === "ready") setOpened(result.content ?? { kind: "text", title: result.title, description: result.description, reference: "" });
										}}
										result={{ winner: true }}
									/>
								</div>
							) : null}
						</section>
					))}
				</Tabs.Panel>
				<Tabs.Panel id='schedule' className='pt-6'>
					<EventRoadmap value={event.schedule} phase={event.phase} readOnly />
				</Tabs.Panel>
				{data.participating ? (
					<Tabs.Panel id='mine' className='space-y-3 pt-6'>
						{data.submissions.length ? (
							data.submissions.map((submission) => (
								<div key={submission.id} className='flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface p-4'>
									<div>
										<p className='text-xs text-muted'>{event.categories.find((c) => c.id === submission.categoryId)?.title}</p>
										<p>{submission.original.title}</p>
										{submission.original.description ? <p className='text-sm text-muted'>{submission.original.description}</p> : null}
									</div>
									{event.phase === "submissions" ? (
										<Button variant='secondary' isPending={busy === submission.id} onPress={() => void withdraw(submission.id)}>
											Withdraw proposal
										</Button>
									) : null}
								</div>
							))
						) : (
							<p className='text-muted'>You have not submitted any proposals.</p>
						)}
					</Tabs.Panel>
				) : null}
			</Tabs>
			<ControlledModal
				isOpen={!!opened}
				onOpenChange={(open) => {
					if (!open) setOpened(null);
				}}
				size='cover'
				ariaLabel={opened?.title}
				dialogClassName='max-w-6xl'
			>
				<Modal.Header>
					<Modal.Heading>{opened?.title}</Modal.Heading>
				</Modal.Header>
				<Modal.Body>{opened ? <EventMedia content={opened} /> : null}</Modal.Body>
			</ControlledModal>
		</main>
	);
}
