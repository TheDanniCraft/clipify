"use client";
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { notify as addToast } from "@lib/toast";
import { usePlausible } from "next-plausible";
import { Accordion, Button, Checkbox, Popover, ProgressCircle } from "@heroui/react";
import { IconChevronRight, IconMinus, IconRotateClockwise } from "@tabler/icons-react";
import { saveUserTourEvent } from "@actions/userTour";
import { journeyGuidePercent, currentGuideStep, defaultProgress, shouldOfferGuideWelcome, guideLocation, journeys, parseProgress, storageKey, transition, tourModalSelector, tourPopoverSelector, type GuideEvent, type GuideProgress, type TaskId } from "@lib/userTour";
import { CONSENT_PREFERENCES_VISIBILITY_EVENT, type ConsentPreferencesVisibilityDetail } from "@lib/consent/events";
import "driver.js/dist/driver.css";
import "./user-tour.css";
import DashboardContentHost from "@components/dashboardContentHost";
import type { DashboardContentItem } from "@lib/dashboardContent";
const guidedWelcome: DashboardContentItem = { key: "guided-welcome", title: "Welcome", headline: "Welcome to Clipify!", intro: "Let’s get your first overlay running.", highlight: { title: "Learn by doing", text: "Follow the real controls to create, configure and use your overlay." }, image: { src: "/clippy/Clippy.svg", alt: "Clippy, the Clipify mascot" }, actionLabel: "Start guided tour" };
const Spotlight = lazy(() => import("./spotlight"));
type GuideContextValue = { report: (event: GuideEvent) => void; activeTask: TaskId | null; resourceIds: { overlayId: string | null; playlistId: string | null } };
const GuideContext = createContext<GuideContextValue>({ report: () => undefined, activeTask: null, resourceIds: { overlayId: null, playlistId: null } });
export const useUserTour = () => useContext(GuideContext);
export function PreviewTourCheckpoint({ ownerId, overlayId, count, isOpen }: { ownerId: string; overlayId: string; count: number; isOpen: boolean }) {
	const { report } = useUserTour();
	useEffect(() => {
		if (isOpen && count > 0) report({ type: "overlay.previewed", ownerId, id: overlayId, count });
	}, [report, ownerId, overlayId, count, isOpen]);
	return null;
}
function TaskCheckbox({ task, selected, current, onRequest, onConfirm, onRestore }: { task: { id: TaskId; title: string }; selected: boolean; current: boolean; onRequest: () => void; onConfirm: () => void; onRestore: () => void }) {
	const [open, setOpen] = useState(false);
	const anchor = useRef<HTMLSpanElement>(null);
	return (
		<Popover
			isOpen={open}
			onOpenChange={(visible) => {
				if (!visible) setOpen(false);
			}}
		>
			<span ref={anchor} className='inline-flex shrink-0 pt-1'>
				<Checkbox
					aria-label={`Mark ${task.title} as done`}
					isSelected={selected && !current}
					isIndeterminate={current}
					variant='secondary'
					onChange={() => {
						if (selected && !current) onRestore();
						else {
							onRequest();
							setOpen(true);
						}
					}}
				>
					<Checkbox.Content>
						<Checkbox.Control className='border border-muted'>
							<Checkbox.Indicator />
						</Checkbox.Control>
					</Checkbox.Content>
				</Checkbox>
			</span>
			<Popover.Content triggerRef={anchor} placement='left' className='z-[1000000002] max-w-64'>
				<Popover.Dialog aria-label={`Skip ${task.title}?`} className='space-y-3 p-2'>
					<Popover.Heading className='text-sm font-semibold'>Skip this task?</Popover.Heading>
					<p className='text-xs text-muted'>You can come back to it anytime.</p>
					<div className='flex justify-end gap-2'>
						<Button size='sm' variant='tertiary' onPress={() => setOpen(false)}>
							Cancel
						</Button>
						<Button
							size='sm'
							onPress={() => {
								onConfirm();
								setOpen(false);
							}}
							data-tour-skip-confirm={task.id}
						>
							Skip task
						</Button>
					</div>
				</Popover.Dialog>
			</Popover.Content>
		</Popover>
	);
}
/** Server state is authoritative. Browser storage is only imported once for older accounts. */
export function UserTourProvider({ accountId, children, appearanceAvailable = true, initialProgress = defaultProgress(), importLegacy = false, dashboardContent = [] }: { accountId: string; children: ReactNode; appearanceAvailable?: boolean; initialProgress?: GuideProgress; importLegacy?: boolean; dashboardContent?: DashboardContentItem[] }) {
	const pathname = usePathname();
	const track = usePlausible();
	const [progress, setProgress] = useState(() => (pathname !== "/dashboard" && !initialProgress.active ? { ...initialProgress, minimized: true } : initialProgress));
	const rawLocation = guideLocation(pathname);
	const location = rawLocation === "overlay" && pathname !== `/dashboard/overlay/${progress.overlayId}` ? "other" : rawLocation === "playlist" && pathname !== `/dashboard/playlist/${progress.playlistId}` ? "other" : rawLocation;
	const [hydrated, setHydrated] = useState(false);
	const [expanded, setExpanded] = useState<string | null>(initialProgress.active?.task.split(".")[0] ?? initialProgress.journeyId ?? "overlay");
	const [message, setMessage] = useState("");
	const [consentOpen, setConsentOpen] = useState(false);
	const [consentBanner, setConsentBanner] = useState(false);
	const [syncState, setSyncState] = useState<"idle" | "saving" | "error">("idle");
	const launcher = useRef<HTMLButtonElement>(null);
	const previousPath = useRef(pathname);
	const imported = useRef(false);
	const minimizeOnEntry = useRef(pathname !== "/dashboard" && !initialProgress.active);
	const pending = useRef<GuideEvent[]>([]);
	const processing = useRef(false);
	const mounted = useRef(true);
	const seenExpertAward = useRef(initialProgress.expertAwardedAt);
	const offerWelcome = shouldOfferGuideWelcome(progress);
	const seenCompletions = useRef(initialProgress.completed);
	const bottom = 96;
	const active = progress.active;
	const activeTask = active?.task ?? null;
	const step = currentGuideStep(progress);
	const drain = useCallback(async () => {
		if (processing.current) return;
		processing.current = true;
		if (mounted.current) setSyncState("saving");
		try {
			while (pending.current.length) {
				const result = await saveUserTourEvent(accountId, pending.current[0]);
				if (!result.ok || result.accountId !== accountId) throw new Error("Guide progress was not saved");
				pending.current.shift();
				if (result.expertAwardedAt && !seenExpertAward.current) {
					seenExpertAward.current = result.expertAwardedAt;
					if (mounted.current) {
						setProgress((current) => ({ ...current, expertAwardedAt: result.expertAwardedAt, expertAwardVersion: 2 }));
						addToast({ title: "Clipify Expert unlocked!", description: "You completed every guide. Your expert badge is now on your member profile.", color: "success" });
					}
				}
			}
			if (mounted.current) setSyncState("idle");
		} catch {
			if (mounted.current) setSyncState("error");
		} finally {
			processing.current = false;
		}
	}, [accountId]);
	const report = useCallback(
		(event: GuideEvent) => {
			if ("ownerId" in event && event.ownerId !== accountId) return;
			setProgress((current) => transition(current, event, accountId));
			pending.current.push(event);
			void drain();
		},
		[accountId, drain],
	);
	useLayoutEffect(() => {
		// The server snapshot is ready before any child action reports.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setHydrated(true);
	}, []);
	useEffect(() => {
		mounted.current = true;
		if (minimizeOnEntry.current) {
			minimizeOnEntry.current = false;
			report({ type: "panel", minimized: true });
		}
		if (importLegacy && !imported.current) {
			imported.current = true;
			try {
				const legacy = parseProgress(localStorage.getItem(storageKey(accountId)));
				// Import the old browser record once into the authoritative account state.
				// eslint-disable-next-line react-hooks/set-state-in-effect
				if (legacy.completed.length || legacy.skipped.length) report({ type: "legacy.import", completed: legacy.completed, skipped: legacy.skipped });
			} catch {
				/* Account progress remains available without browser storage. */
			}
		}
		return () => {
			mounted.current = false;
		};
	}, [accountId, importLegacy, report]);
	useEffect(() => {
		let frame = 0;
		const measure = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => setConsentBanner(Boolean(document.getElementById("consent-banner-title"))));
		};
		const observer = new MutationObserver(measure);
		observer.observe(document.body, { childList: true, subtree: true });
		measure();
		return () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
		};
	}, []);
	useEffect(() => {
		for (const task of progress.completed) if (!seenCompletions.current.includes(task)) track("guide_task_completed", { props: { journey: task.split(".")[0], task } });
		seenCompletions.current = progress.completed;
	}, [progress.completed, track]);
	const pause = useCallback(
		(reason = "") => {
			if (activeTask) track("guide_paused", { props: { journey: activeTask.split(".")[0], task: activeTask } });
			setMessage(reason);
			report({ type: "pause" });
			setTimeout(() => {
				const focusOwner = document.activeElement;
				if (document.querySelector(`${tourModalSelector}, ${tourPopoverSelector}`) || focusOwner?.id === "sentry-feedback" || focusOwner?.tagName === "IFRAME") return;
				launcher.current?.focus();
			}, 0);
		},
		[activeTask, report, track],
	);
	useEffect(() => {
		if (previousPath.current === pathname) return;
		previousPath.current = pathname;
		// Navigation is observed after the user follows normal app controls.
		report({ type: "location", location: guideLocation(pathname) });
	}, [pathname, active, report]);
	useEffect(() => {
		const section = journeys.find((journey) => journey.tasks.some((task) => task.id === activeTask));
		// Keep an automatically continuing flow in its single expanded section.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		if (section) setExpanded(section.id);
	}, [activeTask]);
	useEffect(() => {
		const change = (event: Event) => {
			const visible = (event as CustomEvent<ConsentPreferencesVisibilityDetail>).detail.visible;
			setConsentOpen(visible);
			if (visible && active && !active.paused) pause();
		};
		window.addEventListener(CONSENT_PREFERENCES_VISIBILITY_EVENT, change);
		return () => window.removeEventListener(CONSENT_PREFERENCES_VISIBILITY_EVENT, change);
	}, [active, pause]);
	const start = (task: TaskId) => {
		if (task === "appearance.style" && !appearanceAvailable) {
			setMessage("Theme Studio requires Pro.");
			return;
		}
		setMessage("");
		const section = journeys.find((journey) => journey.tasks.some((item) => item.id === task));
		setExpanded(section?.id ?? "overlay");
		if (active?.task === task) report({ type: "resume", location, pickerOpen: Boolean(document.querySelector('[data-tour="playlist-clip-search"]')) });
		else report({ type: "start", task, location, pickerOpen: Boolean(document.querySelector('[data-tour="playlist-clip-search"]')) });
		track("guide_started", { props: { journey: task.split(".")[0], task } });
	};
	const onPause = useCallback(() => pause(), [pause]);
	const onMissing = useCallback(() => pause(step?.inDialog ? "Clip selection closed. Click the task to reopen it." : "That control isn't available here. Close any open dialog and try the task again."), [pause, step?.inDialog]);
	const onNext = useCallback(() => report({ type: "next" }), [report]);
	const onPrevious = useCallback(() => report({ type: "previous", location, pickerOpen: Boolean(document.querySelector('[data-tour="playlist-clip-search"]')) }), [report, location]);
	const isFinished = (task: TaskId) => progress.completed.includes(task) || progress.skipped.includes(task);
	const currentJourney = journeys.find((journey) => journey.id === (active?.task.split(".")[0] ?? progress.journeyId)) ?? journeys[0];
	const launcherTitle = currentJourney.id === "overlay" ? "Get started" : currentJourney.title;
	const percentage = journeyGuidePercent(progress);
	return (
		<GuideContext.Provider value={{ report, activeTask, resourceIds: { overlayId: progress.overlayId, playlistId: progress.playlistId } }}>
			{children}
			{hydrated && <DashboardContentHost isVisible={!consentOpen && !consentBanner} items={dashboardContent.length ? dashboardContent : offerWelcome ? [guidedWelcome] : []} onStartGuide={offerWelcome ? () => report({ type: "welcome.start", location: rawLocation }) : undefined} onDismissGuide={offerWelcome ? () => report({ type: "welcome.dismiss" }) : undefined} />}
			<span hidden data-guide-sync={syncState} />
			{hydrated && !consentOpen && !consentBanner && (
				<aside aria-label='Clipify guide' style={{ bottom }} className='user-tour-launcher fixed right-4 flex flex-col items-end z-40 max-w-[calc(100vw-2rem)]'>
					{!progress.minimized && (
						<section id='clipify-guide-panel' aria-label='Your Clipify guide' style={{ maxHeight: `calc(100dvh - ${bottom + 80}px)` }} className='mb-3 w-80 overflow-y-auto rounded-2xl border border-separator bg-surface p-4 text-foreground shadow-xl'>
							<div className='mb-2 flex items-center justify-between gap-3'>
								<h2 className='font-semibold'>Get started</h2>
								<Button isIconOnly size='sm' variant='ghost' aria-label='Minimize guide' onPress={() => report({ type: "panel", minimized: true })}>
									<IconMinus size={16} />
								</Button>
							</div>
							{message && (
								<p role='status' className='mb-3 text-xs text-muted'>
									{message}
								</p>
							)}
							{syncState === "error" && (
								<div role='status' className='mb-3 flex items-center justify-between gap-2 text-xs'>
									<span>Could not save progress.</span>
									<Button size='sm' variant='ghost' onPress={() => void drain()}>
										Retry
									</Button>
								</div>
							)}
							<Accordion allowsMultipleExpanded={false} expandedKeys={expanded ? new Set([expanded]) : new Set()} onExpandedChange={(keys) => setExpanded(keys.size ? String([...keys][0]) : null)}>
								{journeys.map((journey) => (
									<Accordion.Item key={journey.id} id={journey.id}>
										<Accordion.Heading>
											<Accordion.Trigger className='gap-2 py-3 text-sm'>
												<span className='flex-1 text-left'>{journey.title}</span>
												<span className='text-xs text-muted'>
													{journey.tasks.filter((task) => isFinished(task.id)).length}/{journey.tasks.length}
												</span>
												<Accordion.Indicator />
											</Accordion.Trigger>
										</Accordion.Heading>
										<Accordion.Panel>
											<Accordion.Body className='px-0 pb-2'>
												<ul className='space-y-1'>
													{journey.tasks.map((task) => {
														const current = activeTask === task.id;
														const finished = isFinished(task.id);
														return (
															<li key={task.id} className={`flex items-start gap-3 rounded-lg px-2 py-2 ${current ? "bg-accent-soft" : ""}`}>
																<TaskCheckbox
																	task={task}
																	selected={finished}
																	current={current}
																	onRestore={() => report({ type: "task.restore", task: task.id })}
																	onRequest={() => {
																		if (active && !active.paused) report({ type: "pause" });
																	}}
																	onConfirm={() => report({ type: "task.skip", task: task.id })}
																/>
																<Button aria-label={task.title} aria-description={current ? "Continue guide" : finished ? "Replay guide" : "Start guide"} variant='ghost' className={`group h-auto min-w-0 flex-1 justify-between gap-2 whitespace-normal px-0 py-0.5 text-left text-sm ${finished && !current ? "text-muted" : ""}`} onPress={() => start(task.id)}>
																	<span>{task.title}</span>
																	{finished && !current ? <IconRotateClockwise size={14} className='shrink-0 opacity-50 group-hover:opacity-100' /> : <IconChevronRight size={14} className='shrink-0 opacity-50 group-hover:opacity-100' />}
																</Button>
															</li>
														);
													})}
												</ul>
											</Accordion.Body>
										</Accordion.Panel>
									</Accordion.Item>
								))}
							</Accordion>
						</section>
					)}
					<Button ref={launcher} data-tour='guide-launcher' aria-label={`${launcherTitle} · ${percentage}%`} aria-expanded={!progress.minimized} aria-controls='clipify-guide-panel' variant='secondary' className='ml-auto h-12 gap-3 rounded-full border border-separator bg-surface pl-2 pr-4 text-foreground shadow-lg' onPress={() => report({ type: "panel", minimized: !progress.minimized })}>
						<ProgressCircle aria-label={`${currentJourney.title} progress`} value={percentage} size='lg' className='relative size-9 shrink-0'>
							<ProgressCircle.Track style={{ width: 36, height: 36 }}>
								<ProgressCircle.TrackCircle style={{ stroke: "var(--color-muted)", opacity: 0.45 }} />
								<ProgressCircle.FillCircle />
							</ProgressCircle.Track>
							<span className='absolute inset-0 grid place-items-center text-[10px] font-semibold'>{`${percentage}%`}</span>
						</ProgressCircle>
						<span className='text-sm font-semibold'>{launcherTitle}</span>
					</Button>
				</aside>
			)}
			{hydrated && !consentOpen && !consentBanner && active && !active.paused && step && (
				<Suspense fallback={null}>
					<Spotlight key={`${active.task}:${active.index}:${active.navigation?.join(",")}:${step.target}`} step={step} onPause={onPause} onMissing={onMissing} onNext={onNext} onPrevious={active.index > 0 ? onPrevious : undefined} />
				</Suspense>
			)}
		</GuideContext.Provider>
	);
}
