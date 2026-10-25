"use client";

import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePlausible } from "next-plausible";
import { IconCheck, IconChevronDown, IconCompass, IconMinus, IconPlayerPlay } from "@tabler/icons-react";
import { defaultProgress, tourModalSelector, journeys, parseProgress, routeForTask, stepsForTask, storageKey, transition, type GuideEvent, type GuideProgress, type TaskId } from "@lib/userTour";
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
	const [bottom, setBottom] = useState(96);
	const launcher = useRef<HTMLButtonElement>(null);
	const previousPath = useRef(pathname);
	const discoveredResource = useRef(false);
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
				setBottom(banner ? Math.max(96, window.innerHeight - banner.getBoundingClientRect().top + 16) : 96);
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
		seenCompletions.current = loaded.completed;
		// Hydrate browser-only preferences before child passive action reports run.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setProgress(loaded);
		setHydrated(true);
	}, [accountId]);

	const report = useCallback(
		(event: GuideEvent) => {
			if (["overlay.ready", "overlay.created", "playlist.ready", "playlist.created"].includes(event.type)) discoveredResource.current = true;
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
		if (active && !active.paused && pathname !== routeForTask(active.task, progress)) {
			// A user leaving a journey keeps their completed work and can resume explicitly.
			// eslint-disable-next-line react-hooks/set-state-in-effect
			pause("You left this guide’s page. Resume to return to your saved work.");
		}
	}, [pathname, active, progress, pause]);

	useEffect(() => {
		if (!discoveredResource.current) return;
		discoveredResource.current = false;
		if (active && !active.paused && pathname === "/dashboard") {
			const destination = routeForTask(active.task, progress);
			if (destination !== pathname) router.push(destination);
		}
	}, [active, pathname, progress, router]);

	const start = (task: TaskId) => {
		if (task === "appearance.style" && !appearanceAvailable) {
			setMessage("Theme Studio requires Pro. You can finish your first overlay with the default look.");
			report({ type: "pause" });
			return;
		}
		setMessage("");
		report({ type: "start", task });
		track("guide_started", { props: { journey: task.split(".")[0], task } });
		const route = routeForTask(task, progress);
		if (pathname !== route) router.push(route);
	};
	const coreDone = journeys[0].tasks.filter((task) => progress.completed.includes(task.id)).length;
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
	const onConfirm = useCallback(() => report({ type: "setup.confirmed" }), [report]);

	return (
		<GuideContext.Provider value={{ report, activeTask }}>
			{children}
			{hydrated && (
				<aside aria-label='Clipify guide' style={{ bottom }} className='user-tour-launcher fixed right-5 z-40 max-w-[calc(100vw-2.5rem)]'>
					{!progress.minimized && (
						<section id='clipify-guide-panel' aria-label='Your Clipify guide' style={{ maxHeight: `max(10rem, calc(100dvh - ${bottom + 88}px))` }} className='mb-3 w-80 overflow-y-auto rounded-2xl border border-separator bg-surface p-4 text-foreground shadow-xl'>
							<div className='mb-1 flex items-center justify-between gap-3'>
								<h2 className='text-base font-semibold'>Your Clipify guide</h2>
								<button type='button' aria-label='Minimize guide' className='rounded-lg p-2 hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-accent' onClick={() => report({ type: "panel", minimized: true })}>
									<IconMinus size={18} />
								</button>
							</div>
							<p className='mb-4 text-xs text-muted'>Learn by doing. Pick a task for step-by-step help.</p>
							{message && (
								<p role='status' className='mb-3 rounded-lg bg-surface-secondary p-3 text-xs'>
									{message}
								</p>
							)}
							{active?.paused && (
								<button
									type='button'
									className='mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground'
									onClick={() => {
										setMessage("");
										if (active.task === "appearance.style" && !appearanceAvailable) {
											setMessage("Theme Studio requires Pro. You can finish your first overlay with the default look.");
											return;
										}
										const route = routeForTask(active.task, progress);
										if (pathname !== route) router.push(route);
										report({ type: "resume" });
									}}
								>
									<IconPlayerPlay size={16} />
									Resume guide
								</button>
							)}

							{active?.paused && (
								<button
									type='button'
									className='mb-3 w-full rounded-lg border border-separator px-3 py-2 text-sm hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-accent'
									onClick={() => {
										const resource = active.task === "playlist.name" || active.task === "playlist.clips" ? "playlist" : "overlay";
										report({ type: "resource.reset", resource });
										setMessage("Open an existing resource from the dashboard or create one, then resume your guide. Your completed tasks are kept.");
										router.push("/dashboard");
									}}
								>
									Choose another {active.task === "playlist.name" || active.task === "playlist.clips" ? "playlist" : "overlay"}
								</button>
							)}
							{journeys.map((journey) => {
								const count = journey.tasks.filter((task) => progress.completed.includes(task.id)).length;
								return (
									<details key={journey.id} open={journey.id === "overlay" ? true : undefined} className='border-t border-separator py-3'>
										<summary className='flex cursor-pointer list-none items-center gap-2 rounded text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent'>
											<IconChevronDown size={14} className='shrink-0' />
											<span className='flex-1'>{journey.title}</span>
											<span className='text-xs text-muted'>
												{count}/{journey.tasks.length}
											</span>
										</summary>
										{journey.optional && <p className='ml-6 mt-1 text-xs text-muted'>{journey.id === "appearance" ? "Optional · Theme Studio requires Pro" : "Optional · explore when you’re ready"}</p>}
										<ul className='mt-2 space-y-1'>
											{journey.tasks.map((task) => (
												<li key={task.id}>
													<button type='button' aria-label={task.title} className='flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-accent' onClick={() => start(task.id)}>
														<span className='mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-separator'>{progress.completed.includes(task.id) && <IconCheck size={12} className='text-success' />}</span>
														<span className='flex-1'>{task.title}</span>
														{progress.completed.includes(task.id) && <span className='text-xs text-muted'>Replay</span>}
													</button>
												</li>
											))}
										</ul>
									</details>
								);
							})}
							<p className='mt-2 text-xs text-muted'>Progress is saved in this browser for your account.</p>
						</section>
					)}
					<button ref={launcher} type='button' aria-expanded={!progress.minimized} aria-controls='clipify-guide-panel' className='ml-auto flex items-center gap-2 rounded-full border border-separator bg-surface px-4 py-3 text-sm font-semibold text-foreground shadow-lg hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-accent' onClick={() => report({ type: "panel", minimized: !progress.minimized })}>
						<IconCompass size={18} className='text-accent' />
						{coreDone === 4 ? "Guides" : `Get started · ${coreDone}/4`}
					</button>
				</aside>
			)}
			{hydrated && active && !active.paused && step && pathname === routeForTask(active.task, progress) && (
				<Suspense fallback={null}>
					<Spotlight key={`${active.task}:${active.index}:${step.target}`} step={step} onPause={onPause} onMissing={onMissing} onNext={onNext} onConfirm={active.task === "overlay.setup" && progress.copiedOverlayId === progress.overlayId ? onConfirm : undefined} />
				</Suspense>
			)}
		</GuideContext.Provider>
	);
}
