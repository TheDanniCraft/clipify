"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Button, Link, Spinner } from "@heroui/react";
import { getEventPresenterAction, getEventPreviewAction, publishEventPresenterResultsAction } from "@actions/events";
import { buildAwardPresenterSteps } from "@lib/eventPresenter";
import type { EventCandidateContent } from "@lib/eventCandidates";
import EventPresenterChat from "./EventPresenterChat";
import { EventMedia, EventNomineeCard } from "./EventMedia";
export type AwardShow = Extract<Awaited<ReturnType<typeof getEventPresenterAction>>, { ok: true }>;
type Show = AwardShow;
function AnimatedNumber({ value }: { value: number }) {
	const [shown, setShown] = useState(0);
	useEffect(() => {
		let frame = 0;
		const start = performance.now();
		function tick(now: number) {
			const progress = Math.min(1, (now - start) / 1100);
			setShown(value * (1 - Math.pow(1 - progress, 3)));
			if (progress < 1) frame = requestAnimationFrame(tick);
		}
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [value]);
	return <>{new Intl.NumberFormat(undefined, { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 }).format(shown)}</>;
}
export default function EventPresenter({ eventId, preview = false, initial, initialSlideId, embedded = false }: { eventId: string; preview?: boolean; initial?: Show; initialSlideId?: string; embedded?: boolean }) {
	const [remoteShow, setShow] = useState<Show | null>(null),
		[secret, setSecret] = useState(""),
		[error, setError] = useState(""),
		[index, setIndex] = useState(() =>
			initial && initialSlideId
				? Math.max(
						0,
						buildAwardPresenterSteps(initial.event).findIndex((step) => "slide" in step && step.slide.id === initialSlideId),
					)
				: 0,
		),
		[opened, setOpened] = useState<EventCandidateContent | null>(null),
		[busy, setBusy] = useState(false);
	const opener = useRef<string | null>(null);
	const show = initial ?? remoteShow;
	useEffect(() => {
		if (initial) return;
		const value = new URLSearchParams(window.location.hash.slice(1)).get("secret") ?? window.location.hash.slice(1);
		let active = true;
		(preview ? getEventPreviewAction(eventId, value) : getEventPresenterAction(eventId, value))
			.then((result) => {
				if (!active) return;
				setSecret(value);
				if (result.ok) setShow(result);
				else setError(preview ? "This preview link is unavailable or has expired. Ask the event team for a new preview." : "This presenter link is unavailable. Ask the event team for a new link.");
			})
			.catch(() => {
				if (active) setError("The show could not load. Reload to try again.");
			});
		return () => {
			active = false;
		};
	}, [eventId, preview, initial]);
	const steps = show ? buildAwardPresenterSteps(show.event) : [],
		step = steps[index];
	const stepCount = steps.length,
		loaded = !!show;
	const close = useCallback(() => {
		setOpened(null);
		requestAnimationFrame(() => {
			if (opener.current) document.querySelector<HTMLButtonElement>(`[data-award-candidate="${CSS.escape(opener.current)}"]`)?.focus();
		});
	}, []);
	const navigate = useCallback(
		(direction: number) => {
			if (opened) {
				close();
				return;
			}
			setIndex((current) => Math.max(0, Math.min(stepCount - 1, current + direction)));
		},
		[opened, close, stepCount],
	);
	useEffect(() => {
		function key(event: KeyboardEvent) {
			if (embedded) return;
			if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
			const target = event.target;
			if (target instanceof HTMLElement && target.closest("input,textarea,select,video,audio,[contenteditable=true]")) return;
			if (event.key === "Escape" && opened) {
				event.preventDefault();
				close();
			} else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
				event.preventDefault();
				navigate(event.key === "ArrowRight" ? 1 : -1);
			}
		}
		window.addEventListener("keydown", key);
		return () => window.removeEventListener("keydown", key);
	}, [navigate, opened, close, embedded]);
	// Check capability revocation and newly closed voting without rearranging the live deck.
	useEffect(() => {
		if (!loaded || !secret || preview) return;
		let active = true;
		const timer = setInterval(() => {
			getEventPresenterAction(eventId, secret)
				.then((result) => {
					if (!active) return;
					if (!result.ok) {
						setShow(null);
						setError("This presenter link is no longer available.");
						return;
					}
					setShow((current) => (current ? { ...result, event: { ...result.event, slides: current.event.slides, presentation: current.event.presentation } } : result));
				})
				.catch(() => {});
		}, 15000);
		return () => {
			active = false;
			clearInterval(timer);
		};
	}, [loaded, eventId, secret, preview]);
	function open(content: EventCandidateContent) {
		opener.current = document.activeElement instanceof HTMLElement ? document.activeElement.getAttribute("data-award-candidate") : null;
		setOpened(content);
	}
	async function publish() {
		setBusy(true);
		setError("");
		try {
			const result = await publishEventPresenterResultsAction(eventId, secret);
			if (!result.ok) {
				setError(result.code === "RESULTS_REQUIRED" ? "Complete missing data results and tied-award decisions in the dashboard, then try again." : result.code === "PHASE_CLOSED" ? "Voting is still open. Results can be published after it closes." : "Results could not be published. Check your link and try again.");
				return;
			}
			const refreshed = await getEventPresenterAction(eventId, secret);
			if (refreshed.ok) setShow(refreshed);
		} catch {
			setError("Results could not be published. Try again.");
		} finally {
			setBusy(false);
		}
	}
	if (!show)
		return (
			<main className='flex min-h-dvh items-center justify-center p-8 text-center'>
				{error ? (
					<div role='alert' className='space-y-4'>
						<p>{error}</p>
						<Button variant='secondary' onPress={() => window.location.reload()}>
							Try again
						</Button>
					</div>
				) : (
					<Spinner aria-label='Loading award show' />
				)}
			</main>
		);
	const Surface = embedded ? "div" : "main";
	const category = step && "categoryId" in step ? show.event.categories.find((c) => c.id === step.categoryId) : undefined;
	const style = show.brand ? ({ "--color-accent": show.brand.themeAccentColor, fontFamily: `${show.brand.fontFamily}, sans-serif` } as React.CSSProperties) : undefined;
	const resultsReady = show.event.phase === "closed" || show.event.phase === "results";
	const winners = show.event.categories.flatMap(
		(c) =>
			c.results
				?.filter((r) => r.winner)
				.flatMap((r) => {
					const candidate = c.candidates.find((candidate) => candidate.id === r.id);
					return candidate ? [{ category: c.title, content: candidate.content }] : [];
				}) ?? (c.dataResult?.status === "ready" ? [{ category: c.title, content: c.dataResult.content ?? { kind: "text" as const, title: c.dataResult.title, description: c.dataResult.description, reference: "" } }] : []),
	);
	return (
		<Surface className={embedded ? "relative min-h-[420px] bg-background text-foreground" : "min-h-dvh bg-background text-foreground"} style={style}>
			{preview && !embedded ? <p className='border-b border-separator bg-surface px-5 py-3 text-sm text-muted'>Read-only event preview. Includes unreviewed candidates. Nothing here changes votes or publishes results.</p> : null}
			{show.brand?.fontSource === "google" ? <link rel='stylesheet' href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(show.brand.fontFamily)}:wght@400;700&display=swap`} /> : null}
			<section className={embedded ? "mx-auto flex min-h-[420px] max-w-[1600px] flex-col justify-center px-5 py-16" : "mx-auto flex min-h-dvh max-w-[1600px] flex-col justify-center px-6 py-16 sm:px-14"} aria-label='Award presentation'>
				{opened ? (
					<div className='space-y-4'>
						<Button variant='tertiary' onPress={close}>
							Back to the show
						</Button>
						<div className={show.event.presentation?.showChat ? "grid gap-5 lg:grid-cols-[3fr_1fr]" : ""}>
							<div className={embedded ? "flex min-h-64 items-center justify-center overflow-hidden rounded-2xl bg-surface" : "flex min-h-[65vh] items-center justify-center overflow-hidden rounded-2xl bg-surface"}>
								<EventMedia content={opened} />
							</div>
							{show.event.presentation?.showChat ? (
								preview ? (
									<aside aria-label='Twitch chat preview' className='rounded-xl bg-surface p-5 text-sm text-muted'>
										Live Twitch reactions appear here during your show.
									</aside>
								) : (
									<EventPresenterChat eventId={eventId} secret={secret} />
								)
							) : null}
						</div>
						<h1 className='text-center text-2xl font-semibold'>{opened.title}</h1>
					</div>
				) : step?.type === "publish" && preview ? (
					<div className='space-y-4 text-center'>
						<h1 className='text-3xl font-semibold'>End of preview</h1>
						<p className='text-muted'>The real show ends with a separate result publication step.</p>
					</div>
				) : step?.type === "publish" ? (
					<div className='mx-auto max-w-2xl space-y-7 text-center'>
						<h1 className='text-4xl font-bold'>{show.event.phase === "results" ? "Results are published" : "Ready to share the results?"}</h1>
						<p className='text-lg text-muted'>{show.event.phase === "results" ? "Everyone can now revisit the winners on your event page." : "Publish when your show is finished. Until then, the audience cannot see the results."}</p>
						{show.event.phase !== "results" ? (
							<Button onPress={publish} isPending={busy}>
								Publish results
							</Button>
						) : (
							<Link href={`/events/${eventId}`} target='_blank'>
								View public results
							</Link>
						)}
						{error ? (
							<p role='alert' className='text-danger'>
								{error}
							</p>
						) : null}
					</div>
				) : step && "slide" in step ? (
					<div key={step.id} className='space-y-8'>
						<motion.header initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className='text-center'>
							<h1 className={embedded ? "break-words text-3xl font-bold" : "break-words text-4xl font-bold sm:text-6xl"}>{step.slide.title || category?.title || show.event.title}</h1>
							{step.type === "welcome" ? <p className='mt-6 whitespace-pre-wrap text-xl text-muted'>{step.slide.text || show.event.description}</p> : step.slide.text ? <p className='mt-5 whitespace-pre-wrap text-xl text-muted'>{step.slide.text}</p> : null}
						</motion.header>
						{step.type === "statistics" ? (
							<div className='grid grid-cols-2 gap-6 lg:grid-cols-4'>
								{step.slide.statistics.map((stat, i) => {
									const value = stat.source === "manual" ? stat.value : show.statistics[stat.source];
									return (
										<div key={i} className='rounded-2xl bg-surface p-6 text-center'>
											<p className='text-4xl font-bold text-accent sm:text-6xl'>{typeof value === "number" ? <AnimatedNumber value={value} /> : "—"}</p>
											<p className='mt-4 text-lg text-muted'>{stat.label}</p>
										</div>
									);
								})}
							</div>
						) : null}
						{(step.type === "nominees" || step.type === "results") && category ? (
							<>
								<p className='text-center text-muted'>
									{step.type === "results" ? (resultsReady ? "The results" : "Results will be available after voting closes") : "The nominees"}
									{step.pages > 1 ? ` (${step.page + 1} / ${step.pages})` : ""}
								</p>
								<div className='grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3'>
									{step.candidateIds.map((id) => {
										const candidate = category.candidates.find((c) => c.id === id);
										return candidate ? <EventNomineeCard key={`${step.type}:${id}`} candidate={candidate} onOpen={() => open(candidate.content)} result={step.type === "results" ? category.results?.find((r) => r.id === id) : undefined} /> : null;
									})}
								</div>
								{!step.candidateIds.length ? <p className='text-center text-muted'>No nominees in this category.</p> : null}
							</>
						) : null}
						{step.type === "data-intro" ? <p className='py-16 text-center text-2xl text-muted'>And the award goes to…</p> : null}
						{step.type === "data-result" ? (
							<div className='mx-auto max-w-3xl space-y-5 text-center'>
								{category?.dataResult?.status === "ready" ? (
									<>
										<h2 className='text-4xl font-bold text-accent'>{category.dataResult.title}</h2>
										{category.dataResult.value !== undefined ? (
											<p className='text-6xl font-bold'>
												<AnimatedNumber value={category.dataResult.value} />
											</p>
										) : null}
										<p className='whitespace-pre-wrap text-xl text-muted'>{category.dataResult.description}</p>
										{category.dataResult.content ? (
											<Button
												variant='secondary'
												onPress={() => {
													const result = category.dataResult;
													if (result?.status === "ready" && result.content) open(result.content);
												}}
											>
												View winner
											</Button>
										) : null}
									</>
								) : (
									<p className='text-xl text-muted'>{resultsReady ? "Complete this category’s result in the dashboard, then reload the presenter." : "Results will be available after voting closes."}</p>
								)}
							</div>
						) : null}
						{step.type === "closing" ? (
							<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
								{winners.map((winner, i) => (
									<Button key={i} variant='secondary' className='h-auto flex-col whitespace-normal p-6 text-center' onPress={() => open(winner.content)}>
										<span className='text-sm text-muted'>{winner.category}</span>
										<span className='text-xl font-semibold'>{winner.content.title}</span>
									</Button>
								))}
							</div>
						) : null}
					</div>
				) : null}
			</section>
			{!show.event.whiteLabel ? <p className={`pointer-events-none ${embedded ? "absolute" : "fixed"} bottom-4 left-5 text-xs text-muted/60`}>Clipify</p> : null}
			<nav aria-label='Show navigation' className={`${embedded ? "absolute" : "fixed"} bottom-3 right-3 flex gap-1 opacity-50 transition-opacity hover:opacity-100 focus-within:opacity-100`}>
				<Button aria-label='Previous slide' variant='tertiary' size='sm' isDisabled={!opened && index === 0} onPress={() => navigate(-1)}>
					←
				</Button>
				<Button aria-label={opened ? "Close media" : "Next slide"} variant='tertiary' size='sm' isDisabled={!opened && index === steps.length - 1} onPress={() => navigate(1)}>
					→
				</Button>
			</nav>
		</Surface>
	);
}
