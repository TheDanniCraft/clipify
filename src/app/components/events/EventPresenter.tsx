"use client";
import { preload } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Button, Link, Spinner } from "@heroui/react";
import { getEventPresenterAction, getEventPreviewAction, publishEventPresenterResultsAction } from "@actions/events";
import { buildAwardPresenterSteps } from "@lib/eventPresenter";
import type { EventCandidateContent } from "@lib/eventCandidates";
import EventInteractionControl from "./EventInteractionControl";
import EventNomineeStage from "./EventNomineeStage";
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
		[stepId, setStepId] = useState(() => {
			if (!initial) return;
			return buildAwardPresenterSteps(initial.event).find((step) => "slide" in step && (!initialSlideId || step.slide.id === initialSlideId) && (!embedded || !step.type.endsWith("-title")))?.id;
		}),
		[opened, setOpened] = useState<EventCandidateContent | null>(null),
		[busy, setBusy] = useState(false);
	const opener = useRef<string | null>(null);
	const [stageNavigation, setStageNavigation] = useState({ instant: false, version: 0 });
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
	const reduceMotion = useReducedMotion();

	const [interactionStatus, setInteractionStatus] = useState<{ slideId: string; blocked: boolean } | null>(null);
	const interactionSlide = !preview && secret && step && "slide" in step && (step.type === "reveal" || step.type === "data-intro" || step.type === "data-result") && step.slide.interaction ? step.slide : undefined;
	const interactionBlocked = !!interactionSlide?.interaction?.wait && (interactionStatus?.slideId !== interactionSlide.id || interactionStatus.blocked);
	const stepCount = steps.length,
		loaded = !!show;
	const close = useCallback(() => {
		setStageNavigation((current) => ({ instant: true, version: current.version + 1 }));
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
			if (direction > 0 && interactionBlocked) return;
			if ((direction < 0 && index === 0) || (direction > 0 && index === stepCount - 1)) return;
			setStageNavigation((current) => ({ instant: direction < 0, version: current.version + (direction < 0 ? 1 : 0) }));
			setStepId(steps[index + direction]?.id);
		},
		[opened, close, stepCount, index, steps, interactionBlocked],
	);
	useEffect(() => {
		function key(event: KeyboardEvent) {
			if (embedded) return;
			if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
			if (event.key === "Escape" && opened) {
				event.preventDefault();
				close();
				return;
			}
			const target = event.target;
			if (target instanceof HTMLElement && target.closest("input,textarea,select,video,audio,[contenteditable=true]")) return;
			if (event.code === "Space" && !opened) {
				if (target instanceof HTMLElement && target.closest("button,a,[role=button]")) return;
				const featured = document.querySelector<HTMLButtonElement>("[data-award-featured] [data-award-candidate]");
				if (featured) {
					event.preventDefault();
					featured.click();
				}
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
	const baseCategory = step && "categoryId" in step ? show.event.categories.find((c) => c.id === step.categoryId) : undefined;
	const category = baseCategory && step && "slide" in step && step.slide.presenterMode ? { ...baseCategory, presenterMode: step.slide.presenterMode } : baseCategory;
	const dataResult = category?.dataResult?.status === "ready" ? category.dataResult : undefined;
	const dataWinner = dataResult?.content;
	const openedHasCaption = opened && ["clip", "youtube", "video", "image", "game"].includes(opened.kind);
	const style = show.brand ? ({ "--color-accent": show.brand.themeAccentColor, fontFamily: `${show.brand.fontFamily}, sans-serif` } as React.CSSProperties) : undefined;
	const titleOnly = step?.type === "statistics-title" || step?.type === "category-title" || step?.type === "closing-title";
	const entrance = { initial: reduceMotion || stageNavigation.instant ? (false as const) : { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4 } };
	const contentEntrance = { initial: reduceMotion || stageNavigation.instant ? (false as const) : { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: reduceMotion || stageNavigation.instant ? 0 : 0.5, duration: 0.2 } };
	for (const candidate of [...(category?.candidates ?? [])].sort((a, b) => a.id.localeCompare(b.id)).slice(step?.type === "nominee" ? step.position : 0, (step?.type === "nominee" ? step.position : 0) + 6)) {
		const source = candidate.content.thumbnailUrl || (candidate.content.kind === "image" ? candidate.content.mediaUrl : undefined);
		if (source) preload(source, { as: "image", fetchPriority: "high" });
	}
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
		<Surface className={`relative flex flex-col bg-background text-foreground ${embedded ? "min-h-[420px]" : "min-h-dvh"}`} style={style}>
			{preview && !embedded ? <p className='border-b border-separator bg-surface px-5 py-3 text-sm text-muted'>Read-only event preview. Includes unreviewed candidates. Nothing here changes votes or publishes results.</p> : null}
			{show.brand?.fontSource === "google" ? <link rel='stylesheet' href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(show.brand.fontFamily)}:wght@400;700&display=swap`} /> : null}
			<section className={`mx-auto flex w-full max-w-[1600px] flex-1 flex-col justify-center ${embedded ? "px-5 py-8" : category || step?.type === "closing" ? "px-6 py-8 sm:px-14 [@media(max-height:800px)]:py-2" : "px-6 py-10 sm:px-14 sm:py-12"}`} aria-label='Award presentation'>
				<div className={show.event.presentation?.showChat ? "grid w-full items-center gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(16rem,1fr)]" : "w-full"}>
					<div className='min-w-0'>
						{opened ? (
							<div className='space-y-4'>
								<div className={`relative mx-auto flex w-full items-center justify-center overflow-hidden rounded-2xl bg-surface ${openedHasCaption ? "aspect-video" : "min-h-64"} ${embedded ? "" : "max-w-[calc(65dvh*16/9)]"}`}>
									<EventMedia content={opened} />
									<Button isIconOnly size='sm' variant='secondary' aria-label='Close preview' className='absolute right-2 top-2 opacity-50 hover:opacity-100 focus-visible:opacity-100' onPress={close}>
										×
									</Button>
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
								<motion.header layout={!reduceMotion ? "position" : false} {...entrance} transition={{ duration: 0.4, layout: { duration: 0.4, ease: "easeInOut" } }} className='text-center'>
									<h1 className={`mx-auto max-w-5xl break-words text-balance font-bold ${embedded ? "text-3xl" : category ? "text-3xl sm:text-5xl" : "text-4xl sm:text-6xl"}`}>{step.slide.title || category?.title || show.event.title}</h1>
									{step.type === "welcome" ? <p className='mx-auto mt-6 max-w-2xl whitespace-pre-wrap text-pretty text-lg text-muted sm:text-xl'>{step.slide.text || show.event.description}</p> : step.slide.text ? <p className='mx-auto mt-5 max-w-2xl whitespace-pre-wrap text-lg text-muted sm:text-xl'>{step.slide.text}</p> : null}
									{category && category.selection !== "data" ? (
										<p aria-hidden={!(titleOnly || step.type === "nominee")} className='mt-2 h-7 text-lg text-muted'>
											{titleOnly || step.type === "nominee" ? "The nominees" : null}
										</p>
									) : null}
								</motion.header>
								{step.type === "statistics" ? (
									<motion.div {...contentEntrance} className='mx-auto grid w-full max-w-6xl grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-5'>
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
								{category && (step.type === "nominee" || step.type === "reveal") ? <EventNomineeStage key={stageNavigation.version} instant={stageNavigation.instant} category={category} position={step.type === "nominee" ? step.position : undefined} place={step.type === "reveal" ? step.place : undefined} onOpen={open} /> : null}
								{step.type === "data-intro" ? (
									<motion.p {...contentEntrance} className='py-16 text-center text-2xl text-muted'>
										And the award goes to…
									</motion.p>
								) : null}
								{step.type === "data-result" ? (
									<motion.div {...contentEntrance} className='mx-auto max-w-3xl space-y-5 text-center'>
										{dataResult && category?.presenterMode === "nominees" ? (
											<>
												<EventNomineeStage key={stageNavigation.version} instant={stageNavigation.instant} category={category} place={1} onOpen={open} />
												{dataResult.value !== undefined ? (
													<p className='text-3xl font-bold text-accent'>
														<AnimatedNumber value={dataResult.value} />
													</p>
												) : null}
											</>
										) : dataResult ? (
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
									<motion.div {...contentEntrance} aria-label='Winner recap' className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
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
					</div>
					{show.event.presentation?.showChat ? (
						preview ? (
							<aside aria-label='Twitch chat preview' className='flex h-[65vh] min-w-0 flex-col rounded-2xl bg-surface p-4'>
								<h2 className='mb-4 text-sm font-semibold text-muted'>Live chat</h2>
								<p className='text-sm text-muted'>Live Twitch reactions appear here during your show.</p>
							</aside>
						) : (
							<EventPresenterChat eventId={eventId} secret={secret} />
						)
					) : null}
				</div>
			</section>
			<footer className='flex shrink-0 flex-wrap items-center justify-between gap-4 px-5 pb-4 pt-3'>
				{!show.event.whiteLabel ? <p className='pointer-events-none text-xs text-muted/60'>Clipify</p> : <span />}
				{interactionSlide?.interaction ? <EventInteractionControl key={interactionSlide.id} eventId={eventId} secret={secret} slideId={interactionSlide.id} type={interactionSlide.interaction.type} wait={interactionSlide.interaction.wait} winner={step?.type === "data-result" || (step?.type === "reveal" && step.place === 1)} onState={setInteractionStatus} /> : null}
				<nav aria-label='Show navigation' className='flex gap-1 opacity-50 transition-opacity hover:opacity-100 focus-within:opacity-100'>
					<Button aria-label='Previous slide' variant='tertiary' size='sm' isDisabled={!opened && index === 0} onPress={() => navigate(-1)}>
						←
					</Button>
					<Button aria-label={opened ? "Close media" : "Next slide"} variant='tertiary' size='sm' isDisabled={!opened && (index === steps.length - 1 || interactionBlocked)} onPress={() => navigate(1)}>
						→
					</Button>
				</nav>
			</footer>
		</Surface>
	);
}
