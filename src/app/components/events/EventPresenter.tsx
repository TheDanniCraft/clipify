"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { Button, Link, Spinner } from "@heroui/react";
import { getEventPresenterAction, getEventPreviewAction, publishEventPresenterResultsAction } from "@actions/events";
import { buildAwardPresenterSteps, rankAwardNominees } from "@lib/eventPresenter";
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
		[stepId, setStepId] = useState(() => (initial && initialSlideId ? buildAwardPresenterSteps(initial.event).find((step) => "slide" in step && step.slide.id === initialSlideId)?.id : undefined)),
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
	const event = show?.event;
	const steps = useMemo(() => (event ? buildAwardPresenterSteps(event) : []), [event]),
		index = Math.max(
			0,
			steps.findIndex((step) => step.id === stepId),
		),
		step = steps[index];
	const layoutId = useId();
	const reduceMotion = useReducedMotion();

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
			if ((direction < 0 && index === 0) || (direction > 0 && index === stepCount - 1)) return;
			setStepId(steps[index + direction]?.id);
		},
		[opened, close, stepCount, index, steps],
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
	const dataResult = category?.dataResult?.status === "ready" ? category.dataResult : undefined;
	const dataWinner = dataResult?.content;
	const openedHasCaption = opened && ["clip", "youtube", "video", "image", "game"].includes(opened.kind);
	const style = show.brand ? ({ "--color-accent": show.brand.themeAccentColor, fontFamily: `${show.brand.fontFamily}, sans-serif` } as React.CSSProperties) : undefined;
	const titleOnly = step?.type === "statistics-title" || step?.type === "category-title" || step?.type === "closing-title";
	const entrance = { initial: reduceMotion ? (false as const) : { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } };
	const resultsReady = show.event.phase === "closed" || show.event.phase === "results";
	const reveal = step?.type === "reveal" ? step : undefined;
	const ranked = reveal && category ? rankAwardNominees(category) : [];
	const final = reveal?.place === 1;
	const revealedWinners = final ? ranked.filter(({ result }) => result.winner) : [];
	const others = ranked.filter(({ result }) => !final || !result.winner);

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
		<Surface className={`relative flex flex-col bg-background text-foreground ${embedded ? "min-h-[420px]" : "min-h-dvh"}`} style={style}>
			{preview && !embedded ? <p className='border-b border-separator bg-surface px-5 py-3 text-sm text-muted'>Read-only event preview. Includes unreviewed candidates. Nothing here changes votes or publishes results.</p> : null}
			{show.brand?.fontSource === "google" ? <link rel='stylesheet' href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(show.brand.fontFamily)}:wght@400;700&display=swap`} /> : null}
			<section className={`mx-auto flex w-full max-w-[1600px] flex-1 flex-col ${(category && !titleOnly) || step?.type === "statistics" || step?.type === "closing" ? "justify-start" : "justify-center"} ${embedded ? "px-5 py-8" : category || step?.type === "closing" ? "px-6 py-8 sm:px-14" : "px-6 py-10 sm:px-14 sm:py-12"}`} aria-label='Award presentation'>
				{opened ? (
					<div className='space-y-4'>
						<Button variant='tertiary' onPress={close}>
							Back to the show
						</Button>
						<div className={show.event.presentation?.showChat ? "grid gap-5 lg:grid-cols-[3fr_1fr]" : ""}>
							<div className={`mx-auto flex w-full items-center justify-center overflow-hidden rounded-2xl bg-surface ${openedHasCaption ? "aspect-video" : "min-h-64"} ${embedded ? "" : "max-w-[calc(65dvh*16/9)]"}`}>
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
						{openedHasCaption ? <h1 className='text-center text-2xl font-semibold'>{opened.title}</h1> : null}
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
					<div key={step.slide.id} className={category ? "space-y-4" : "space-y-6 sm:space-y-8"}>
						<motion.header layout={!reduceMotion ? "position" : false} {...entrance} className='text-center'>
							<h1 className={`mx-auto max-w-5xl break-words text-balance font-bold ${embedded ? "text-3xl" : category ? "text-3xl sm:text-5xl" : "text-4xl sm:text-6xl"}`}>{step.slide.title || category?.title || show.event.title}</h1>
							{step.type === "welcome" ? <p className='mx-auto mt-6 max-w-2xl whitespace-pre-wrap text-pretty text-lg text-muted sm:text-xl'>{step.slide.text || show.event.description}</p> : step.slide.text ? <p className='mx-auto mt-5 max-w-2xl whitespace-pre-wrap text-lg text-muted sm:text-xl'>{step.slide.text}</p> : null}
							{category && step.type !== "data-intro" && step.type !== "data-result" && category.selection !== "data" && (titleOnly || step.type === "nominee") ? <p className='mt-2 text-lg text-muted'>The nominees</p> : null}
						</motion.header>
						{step.type === "statistics" ? (
							<motion.div {...entrance} transition={{ ...entrance.transition, delay: reduceMotion ? 0 : 0.2 }} className='mx-auto grid w-full max-w-6xl grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-5'>
								{step.slide.statistics.map((stat, i) => {
									const value = stat.source === "manual" ? stat.value : show.statistics[stat.source];
									return (
										<div key={i} className='rounded-2xl bg-surface p-6 text-center'>
											<p className='text-4xl font-bold text-accent tabular-nums sm:text-6xl'>{typeof value === "number" ? <AnimatedNumber value={value} /> : "—"}</p>
											<p className='mt-4 text-lg text-muted'>{stat.label}</p>
										</div>
									);
								})}
							</motion.div>
						) : null}
						{step.type === "nominee" && category ? (
							<LayoutGroup id={layoutId}>
								<div aria-label='Category nominees' className='mx-auto max-w-xl'>
									{category.candidates.slice(step.position, step.position + 1).map((candidate) => (
										<motion.div key={candidate.id} layoutId={reduceMotion ? undefined : candidate.id} {...entrance}>
											<EventNomineeCard candidate={candidate} onOpen={() => open(candidate.content)} />
										</motion.div>
									))}
								</div>
								{step.position > 0 ? (
									<div aria-label='Previously presented nominees' className='mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6'>
										{category.candidates.slice(0, step.position).map((candidate) => (
											<motion.div key={candidate.id} layoutId={reduceMotion ? undefined : candidate.id}>
												<EventNomineeCard candidate={candidate} onOpen={() => open(candidate.content)} />
											</motion.div>
										))}
									</div>
								) : null}
							</LayoutGroup>
						) : null}
						{reveal && category ? (
							<div className='mx-auto max-w-4xl space-y-4'>
								{!resultsReady ? <p className='text-center text-muted'>Results will be available after voting closes.</p> : !ranked.some(({ result }) => result.votes > 0) ? <p className='text-center text-muted'>No votes were cast.</p> : <p className='text-center text-muted'>{revealedWinners.length ? "And the award goes to…" : final ? "The results" : "The reveal"}</p>}
								{revealedWinners.length > 0 ? (
									<motion.div {...entrance} aria-label='Award winners' className='mx-auto flex max-w-3xl flex-wrap justify-center gap-4'>
										{revealedWinners.map(({ candidate, result }) => (
											<div key={candidate.id} className='w-full max-w-sm'>
												<EventNomineeCard candidate={candidate} result={result} onOpen={() => open(candidate.content)} />
											</div>
										))}
									</motion.div>
								) : null}
								<ol aria-label='Nominee results' className='space-y-2'>
									{(reveal.place === 0 ? category.candidates : others.map(({ candidate }) => candidate)).map((candidate, i) => {
										const entry = others.find((item) => item.candidate.id === candidate.id);
										const visible = final || (reveal.place > 1 && !!entry?.place && entry.place >= reveal.place && entry.place <= 3);
										const place = reveal.place === 0 ? i + 1 : entry?.place;
										return (
											<li key={reveal.place === 0 ? i : candidate.id} className='flex min-h-14 items-center gap-3 rounded-xl border border-separator bg-surface px-4'>
												<span className='w-9 shrink-0 text-sm font-semibold text-muted'>{place ? `#${place}` : "—"}</span>
												{visible && entry ? (
													<motion.div key={candidate.id} {...entrance} className='flex min-w-0 flex-1 items-center justify-between gap-3'>
														<Button data-award-candidate={candidate.id} variant='tertiary' className='h-auto min-w-0 whitespace-normal py-2 text-left' onPress={() => open(candidate.content)}>
															{candidate.content.title}
														</Button>
														<span className='shrink-0 text-sm tabular-nums text-muted'>
															{entry.result.votes} {entry.result.votes === 1 ? "vote" : "votes"}
														</span>
													</motion.div>
												) : (
													<span className='text-muted' aria-label='Hidden nominee'>
														—
													</span>
												)}
											</li>
										);
									})}
								</ol>
							</div>
						) : null}
						{step.type === "data-intro" ? (
							<motion.p {...entrance} className='py-16 text-center text-2xl text-muted'>
								And the award goes to…
							</motion.p>
						) : null}
						{step.type === "data-result" ? (
							<motion.div {...entrance} className='mx-auto max-w-3xl space-y-5 text-center'>
								{dataResult ? (
									<>
										<h2 className='text-4xl font-bold text-accent'>{dataResult.title}</h2>
										{dataResult.value !== undefined ? (
											<p className='text-6xl font-bold'>
												<AnimatedNumber value={dataResult.value} />
											</p>
										) : null}
										<p className='whitespace-pre-wrap text-xl text-muted'>{dataResult.description}</p>
										{dataWinner ? (
											<motion.div {...entrance} className='mx-auto max-w-sm'>
												<EventNomineeCard candidate={{ id: dataWinner.reference || step.categoryId, content: dataWinner }} result={{ winner: true }} onOpen={() => open(dataWinner)} />
											</motion.div>
										) : null}
									</>
								) : (
									<p className='text-xl text-muted'>{resultsReady ? "Complete this category’s result in the dashboard, then reload the presenter." : "Results will be available after voting closes."}</p>
								)}
							</motion.div>
						) : null}
						{step.type === "closing" ? (
							<motion.div {...entrance} aria-label='Winner recap' className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
								{winners.map((winner, i) => (
									<div key={i} className='grid grid-rows-[auto_1fr] gap-2'>
										<p className='text-sm font-semibold text-muted'>{winner.category}</p>
										<EventNomineeCard candidate={{ id: `recap-${i}`, content: winner.content }} onOpen={() => open(winner.content)} />
									</div>
								))}
							</motion.div>
						) : null}
					</div>
				) : null}
			</section>
			<footer className='flex shrink-0 items-center justify-between gap-4 px-5 pb-4 pt-3'>
				{!show.event.whiteLabel ? <p className='pointer-events-none text-xs text-muted/60'>Clipify</p> : <span />}
				<nav aria-label='Show navigation' className='flex gap-1 opacity-50 transition-opacity hover:opacity-100 focus-within:opacity-100'>
					<Button aria-label='Previous slide' variant='tertiary' size='sm' isDisabled={!opened && index === 0} onPress={() => navigate(-1)}>
						←
					</Button>
					<Button aria-label={opened ? "Close media" : "Next slide"} variant='tertiary' size='sm' isDisabled={!opened && index === steps.length - 1} onPress={() => navigate(1)}>
						→
					</Button>
				</nav>
			</footer>
		</Surface>
	);
}
