"use client";

import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePlausible } from "next-plausible";
import { IconChevronDown, IconMinus } from "@tabler/icons-react";
import { defaultProgress, tourModalSelector, journeys, parseProgress, routeForTask, stepsForTask, storageKey, transition, type GuideEvent, type GuideProgress, type TaskId } from "@lib/userTour";
import { Button, Checkbox, Chip, ProgressBar, Link } from "@heroui/react";
import { CONSENT_PREFERENCES_VISIBILITY_EVENT, type ConsentPreferencesVisibilityDetail } from "@lib/consent/events";
import "driver.js/dist/driver.css";
import "./user-tour.css";

const Spotlight = lazy(() => import("./spotlight"));
const GuideContext = createContext<{ report: (event: GuideEvent) => void; activeTask: TaskId | null }>({ report: () => undefined, activeTask: null });
export const useUserTour = () => useContext(GuideContext);

/** Report a nonempty preview after asynchronous clip loading, while it is visible. */
export function PreviewTourCheckpoint({ ownerId, overlayId, count, isOpen }: { ownerId: string; overlayId: string; count: number; isOpen: boolean }) {
	const { report } = useUserTour();
	useEffect(() => {
		if (isOpen && count > 0) report({ type: "overlay.previewed", ownerId, id: overlayId, count });
	}, [report, ownerId, overlayId, count, isOpen]);
	return null;
}

/** Key this boundary by account so no in-memory progress can cross accounts. */
export function UserTourProvider({ accountId, children, appearanceAvailable = true }: { accountId: string; children: ReactNode; appearanceAvailable?: boolean }) {
	const router = useRouter();
	const pathname = usePathname();
	const track = usePlausible();
	const [progress, setProgress] = useState<GuideProgress>(defaultProgress);
	const [hydrated, setHydrated] = useState(false);
	const [message, setMessage] = useState("");
	const [bottom, setBottom] = useState(16);
	const [consentOpen, setConsentOpen] = useState(false);
	const [consentBanner, setConsentBanner] = useState(false);
	const [skipTask, setSkipTask] = useState<TaskId | null>(null);
	const launcher = useRef<HTMLButtonElement>(null);
	const previousPath = useRef(pathname);
	const seenCompletions = useRef<TaskId[]>([]);
	const active = progress.active;
	const activeTask = active?.task ?? null;

	useEffect(() => {
		let frame = 0;
		let banner: HTMLElement | null = null;
		const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => measure());
		const measure = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				const current = document.getElementById("consent-banner-title")?.closest("aside") ?? null;
				if (current !== banner) {
					resize?.disconnect();
					banner = current;
					if (banner) resize?.observe(banner);
				}
				setConsentBanner(Boolean(banner));
				setBottom(banner ? Math.max(16, window.innerHeight - banner.getBoundingClientRect().top + 16) : 16);
			});
		};
		const observer = new MutationObserver(measure);
		observer.observe(document.body, { childList: true, subtree: true });
		window.addEventListener("resize", measure);
		measure();
		return () => {
			observer.disconnect();
			resize?.disconnect();
			window.removeEventListener("resize", measure);
			cancelAnimationFrame(frame);
		};
	}, []);

	useLayoutEffect(() => {
		let loaded = defaultProgress();
		try {
			loaded = parseProgress(localStorage.getItem(storageKey(accountId)));
		} catch {
			/* Keep the guide usable when storage is blocked. */
		}
		if (previousPath.current !== "/dashboard" && !loaded.active) loaded.minimized = true;
		seenCompletions.current = loaded.completed;
		// Hydrate browser-only preferences before child passive action reports run.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setProgress(loaded);
		setHydrated(true);
	}, [accountId]);

	const report = useCallback(
		(event: GuideEvent) => {
			setProgress((current) => transition(current, event, accountId));
		},
		[accountId],
	);

	useEffect(() => {
		if (!hydrated) return;
		try {
			localStorage.setItem(storageKey(accountId), JSON.stringify(progress));
		} catch {
			/* Session progress remains available. */
		}
		for (const task of progress.completed) {
			if (!seenCompletions.current.includes(task)) track("guide_task_completed", { props: { journey: task.split(".")[0], task } });
		}
		seenCompletions.current = progress.completed;
	}, [accountId, hydrated, progress, track]);

	const pause = useCallback(
		(reason = "Guide paused. You can continue whenever you’re ready.") => {
			if (activeTask) track("guide_paused", { props: { journey: activeTask.split(".")[0], task: activeTask } });
			setMessage(reason);
			report({ type: "pause" });
			if (!document.querySelector(tourModalSelector)) window.setTimeout(() => launcher.current?.focus(), 0);
		},
		[report, activeTask, track],
	);

	useEffect(() => {
		if (previousPath.current === pathname) return;
		previousPath.current = pathname;
		if (!active || active.done) {
			// Navigation hides the welcome panel; active tours retain their handoff state.
			// eslint-disable-next-line react-hooks/set-state-in-effect
			report({ type: "panel", minimized: true });
			return;
		}
		if (active && !active.paused && pathname !== routeForTask(active.task, progress)) {
			// A user leaving a journey keeps their completed work and can resume explicitly.
			pause("You left this guide’s page. Resume to return to your saved work.");
		}
	}, [pathname, active, progress, pause, report]);

	const start = (task: TaskId) => {
		if (task === "appearance.style" && !appearanceAvailable) {
			setMessage("Theme Studio requires Pro. You can finish your first overlay with the default look.");
			report({ type: "pause" });
			return;
		}
		setMessage("");
		report({ type: "start", task });
		track("guide_started", { props: { journey: task.split(".")[0], task } });
		const route = routeForTask(task, transition(progress, { type: "start", task }, accountId));
		if (pathname !== route) router.push(route);
	};
	const isFinished = (task: TaskId) => progress.completed.includes(task) || progress.skipped.includes(task);
	const coreDone = journeys[0].tasks.filter((task) => isFinished(task.id)).length;
	const activeSteps = active ? stepsForTask(active.task, progress) : [];
	const activeTitle = journeys.map((journey) => journey.tasks.find((task) => task.id === active?.task)?.title).find(Boolean);
	const journey = journeys.find((journey) => journey.tasks.some((task) => task.id === active?.task));
	const nextTask = journey?.tasks.find((task) => !isFinished(task.id));
	const step = active ? stepsForTask(active.task, progress)[active.index] : undefined;
	const onPause = useCallback(() => {
		pause();
	}, [pause]);
	const onMissing = useCallback(() => {
		pause("This control is not available here. Close any open dialog, check that you can access the resource, then resume. You can also open an existing resource from the dashboard and restart the task.");
	}, [pause]);
	const onNext = useCallback(() => {
		report({ type: "next" });
	}, [report]);

	useEffect(() => {
		const change = (event: Event) => {
			const visible = (event as CustomEvent<ConsentPreferencesVisibilityDetail>).detail.visible;
			setConsentOpen(visible);
			if (visible && active && !active.paused && !active.done) pause("Your guide is paused while you choose your consent settings.");
		};
		window.addEventListener(CONSENT_PREFERENCES_VISIBILITY_EVENT, change);
		return () => window.removeEventListener(CONSENT_PREFERENCES_VISIBILITY_EVENT, change);
	}, [active, pause]);
	useEffect(() => {
		document.body.classList.add("clipify-guide-mounted");
		document.body.style.setProperty("--clipify-guide-bottom", `${bottom}px`);
		return () => {
			document.body.classList.remove("clipify-guide-mounted");
			document.body.style.removeProperty("--clipify-guide-bottom");
		};
	}, [bottom]);
	const resume = () => {
		if (!active) return;
		if (active.task === "appearance.style" && !appearanceAvailable) {
			setMessage("Theme Studio requires Pro. You can finish your first overlay with the default look.");
			return;
		}
		setMessage("");
		const route = routeForTask(active.task, progress);
		if (pathname !== route) router.push(route);
		report({ type: "resume" });
	};
	const progressBar = (value: number, label: string) => (
		<ProgressBar aria-label={label} value={value} className='w-full' size='sm'>
			<ProgressBar.Track>
				<ProgressBar.Fill />
			</ProgressBar.Track>
		</ProgressBar>
	);

	return (
		<GuideContext.Provider value={{ report, activeTask }}>
			{children}
			{hydrated && !consentOpen && !consentBanner && (
				<aside aria-label='Clipify guide' style={{ bottom }} className='user-tour-launcher fixed right-4 z-40 max-w-[calc(100vw-2rem)]'>
					{!progress.minimized && (
						<section id='clipify-guide-panel' aria-label='Your Clipify guide' style={{ maxHeight: `max(8rem, calc(100dvh - ${bottom + 168}px))` }} className='mb-24 w-80 overflow-y-auto rounded-2xl border border-separator bg-surface p-4 text-foreground shadow-xl'>
							<div className='flex items-center justify-between gap-3'>
								<h2 className='text-base font-semibold'>Your Clipify guide</h2>
								<Button isIconOnly size='sm' variant='ghost' aria-label='Minimize guide' onPress={() => report({ type: "panel", minimized: true })}>
									<IconMinus size={18} />
								</Button>
							</div>
							<p className='mb-4 text-xs text-muted'>Pick a task to learn by doing. Check a box to skip it.</p>
							{message && (
								<p role='status' className='mb-3 rounded-lg bg-surface-secondary p-3 text-xs'>
									{message}
								</p>
							)}
							{active?.done && (
								<div role='status' className='mb-3 space-y-2 rounded-lg bg-success-soft p-3 text-sm'>
									<p>{activeTitle} — done.</p>
									{nextTask ? (
										<Button size='sm' variant='primary' onPress={() => start(nextTask.id)}>
											Continue: {nextTask.title}
										</Button>
									) : (
										<p>You’re ready. Explore another guide whenever you like.</p>
									)}
								</div>
							)}
							{active?.paused && !active.done && (
								<Button
									size='sm'
									variant='tertiary'
									className='mb-3 w-full'
									onPress={() => {
										const resource = active.task === "playlist.name" || active.task === "playlist.clips" ? "playlist" : "overlay";
										report({ type: "resource.reset", resource });
										setMessage("Open another resource, then click the in-progress task to continue. Your completed tasks are kept.");
										router.push("/dashboard");
									}}
								>
									Choose another {active.task.startsWith("playlist.") ? "playlist" : "overlay"}
								</Button>
							)}
							{journeys.map((journey) => {
								const count = journey.tasks.filter((task) => isFinished(task.id)).length;
								return (
									<details key={journey.id} open={journey.id === "overlay" || journey.tasks.some((task) => task.id === active?.task) ? true : undefined} className='border-t border-separator py-3'>
										<summary className='flex cursor-pointer list-none items-center gap-2 rounded text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent'>
											<IconChevronDown size={14} className='shrink-0' />
											<span className='flex-1'>{journey.title}</span>
											<span className='text-xs text-muted'>
												{count}/{journey.tasks.length}
											</span>
										</summary>
										{journey.optional && <p className='ml-6 mt-1 text-xs text-muted'>{journey.id === "appearance" ? "Optional · Theme Studio requires Pro" : "Optional · explore when you’re ready"}</p>}
										<ul className='mt-2 space-y-1'>
											{journey.tasks.map((task) => {
												const current = active?.task === task.id && !active.done;
												return (
													<li key={task.id} className='rounded-lg px-1 py-1'>
														<div className='flex items-start gap-2'>
															<Checkbox
																className='mt-0.5 shrink-0'
																variant='secondary'
																aria-label={`Mark ${task.title} as done`}
																isSelected={isFinished(task.id)}
																onChange={() => {
																	if (isFinished(task.id)) report({ type: "task.restore", task: task.id });
																	else {
																		setSkipTask(task.id);
																		if (active && !active.paused && !active.done) pause();
																		report({ type: "panel", minimized: false });
																	}
																}}
															>
																<Checkbox.Content>
																	<Checkbox.Control className='border border-muted'>
																		<Checkbox.Indicator />
																	</Checkbox.Control>
																</Checkbox.Content>
															</Checkbox>
															<div className='min-w-0 flex-1'>
																<Button aria-label={task.title} variant='ghost' className='h-auto w-full justify-start whitespace-normal px-1 py-0 text-left text-sm' onPress={() => (current ? resume() : start(task.id))}>
																	{task.title}
																</Button>
																{current ? (
																	<div className='mt-1 space-y-1'>
																		<Chip size='sm' variant='soft'>
																			{active.paused ? "In progress · click to continue" : `Step ${active.index + 1} of ${activeSteps.length}`}
																		</Chip>
																		{progressBar((active.index / activeSteps.length) * 100, `${task.title} progress`)}
																	</div>
																) : (
																	isFinished(task.id) && <span className='text-xs text-muted'>{progress.skipped.includes(task.id) ? "Skipped · click to explore" : "Completed · click to replay"}</span>
																)}
															</div>
														</div>
														{skipTask === task.id && (
															<div role='group' aria-label='Skip this task?' className='mt-2 rounded-lg bg-surface-secondary p-3 text-xs'>
																<p>Skip this task? You can uncheck it and return anytime.</p>
																<div className='mt-2 flex gap-2'>
																	<Button
																		size='sm'
																		variant='primary'
																		onPress={() => {
																			report({ type: "task.skip", task: task.id });
																			setSkipTask(null);
																		}}
																	>
																		Skip task
																	</Button>
																	<Button size='sm' variant='tertiary' onPress={() => setSkipTask(null)}>
																		Cancel
																	</Button>
																</div>
															</div>
														)}
													</li>
												);
											})}
										</ul>
									</details>
								);
							})}
							<div data-tour='guide-support' className='mt-2 rounded-lg bg-surface-secondary p-3 text-xs'>
								<p>Need a hand? Report a problem at the bottom right, or use support chat at the bottom left. Chat follows your consent settings.</p>
								<Link href='https://help.clipify.us/' target='_blank' rel='noopener noreferrer' className='mt-2 text-xs'>
									Open help center
								</Link>
							</div>
							<p className='mt-3 text-xs text-muted'>Progress is saved in this browser for your account.</p>
						</section>
					)}
					<Button ref={launcher} aria-expanded={!progress.minimized} aria-controls='clipify-guide-panel' variant='secondary' className='ml-auto flex h-auto w-56 max-w-full flex-col items-stretch gap-2 rounded-2xl border border-separator bg-surface px-4 py-3 text-foreground shadow-lg' onPress={() => report({ type: "panel", minimized: !progress.minimized })}>
						<span className='text-sm font-semibold'>{coreDone === 4 ? "Guides" : `Get started · ${coreDone}/4`}</span>
						{progressBar(active && !active.done ? (active.index / activeSteps.length) * 100 : (coreDone / 4) * 100, active && !active.done ? "Current task progress" : "Getting started progress")}
					</Button>
				</aside>
			)}
			{hydrated && !consentOpen && !consentBanner && active && !active.paused && !active.done && step && pathname === routeForTask(active.task, progress) && (
				<Suspense fallback={null}>
					<Spotlight key={`${active.task}:${active.index}:${step.target}`} step={step} onPause={onPause} onMissing={onMissing} onNext={onNext} />
				</Suspense>
			)}
		</GuideContext.Provider>
	);
}
