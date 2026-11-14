"use client";
import { useLayoutEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { IconTrophy } from "@tabler/icons-react";
import type { PublicAwardEvent } from "@lib/eventPublicView";
import { rankAwardNominees } from "@lib/eventPresenter";
import type { EventCandidateContent } from "@lib/eventCandidates";
import { EventNomineeCard } from "./EventMedia";
import EventPodiumCelebration from "./EventPodiumCelebration";

type Category = PublicAwardEvent["categories"][number];

export default function EventNomineeStage({ category, position, place, onOpen, instant = false, cue }: { category: Category; position?: number; place?: number; onOpen: (content: EventCandidateContent) => void; instant?: boolean; cue?: boolean }) {
	const stage = useRef<HTMLDivElement>(null);
	const previous = useRef(new Map<string, { box: DOMRect; featured: boolean; stacked: boolean }>());
	const reduceMotion = useReducedMotion();
	const immediate = instant || !!reduceMotion;
	const reveal = place !== undefined;
	const final = place === 1 && !cue;
	const candidates = [...category.candidates].sort((a, b) => a.id.localeCompare(b.id));
	const ranked = rankAwardNominees(category);
	const dataWinnerId = category.selection === "data" ? category.candidates[0]?.id : undefined;
	const featured = reveal && !cue ? ranked.filter((entry) => (final ? entry.result.winner : place !== 0 && entry.place === place)) : [];
	const activeIds = new Set(reveal ? (dataWinnerId && final ? [dataWinnerId] : featured.map(({ candidate }) => candidate.id)) : candidates.slice(position, (position ?? 0) + 1).map(({ id }) => id));
	const active = candidates.filter(({ id }) => activeIds.has(id));
	const drawing = reveal && (place ?? 0) > 0 && category.selection !== "data" && category.presenterMode !== "winner";
	const settled = drawing ? ranked.filter((entry) => entry.place && entry.place <= 3 && entry.place > (place ?? 0) && !activeIds.has(entry.candidate.id)) : [];
	const settledIds = new Set(settled.map((entry) => entry.candidate.id));
	const waiting = candidates.filter((candidate) => !activeIds.has(candidate.id) && !settledIds.has(candidate.id));
	const podium = reveal && (place ?? 0) > 0 && active.length > 0;
	const flightDuration = 0.55,
		cueDuration = final ? 0.85 : 0.45;
	const arrival = cue === false ? flightDuration : flightDuration * 2 + cueDuration;
	useLayoutEffect(() => {
		const panel = stage.current?.querySelector<HTMLElement>("[data-award-podium-scroll]");
		if (panel) panel.scrollLeft = (panel.scrollWidth - panel.clientWidth) / 2;
		const nodes = [...(stage.current?.querySelectorAll<HTMLElement>("[data-award-flight]") ?? [])];
		const targets = nodes.map((node) => ({ node, box: node.getBoundingClientRect(), featured: node.dataset.featured === "true", stacked: node.dataset.stacked === "true", old: previous.current.get(node.dataset.awardFlight!) }));
		const returning = targets.some(({ featured, old }) => old?.featured && !featured);
		const flights: { animation: Animation; node: HTMLElement; slot: HTMLElement }[] = [];
		if (!immediate)
			for (const { node, box, featured, stacked, old } of targets) {
				if (!box.width || !node.animate) continue;
				if (old && Math.abs(old.box.x - box.x) + Math.abs(old.box.y - box.y) + Math.abs(old.box.width - box.width) + Math.abs(old.box.height - box.height) < 1) continue;
				const reshape = old && old.stacked !== stacked;
				const slot = node.parentElement!;
				slot.style.height = `${slot.getBoundingClientRect().height}px`;
				// Fixed positioning lets the single card fly outside the scrollable strip without clipping.
				Object.assign(node.style, { position: "fixed", left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, ...(reshape ? { height: `${box.height}px`, overflow: "hidden" } : {}), zIndex: "40" });
				const animation = node.animate(
					[
						{ transform: old ? `translate(${old.box.x - box.x}px, ${old.box.y - box.y}px)` : "translate(0, 16px)", width: `${old?.box.width ?? box.width}px`, ...(reshape ? { height: `${old.box.height}px` } : {}), opacity: old ? 1 : 0 },
						{ transform: "translate(0, 0)", width: `${box.width}px`, ...(reshape ? { height: `${box.height}px` } : {}), opacity: 1 },
					],
					{ duration: flightDuration * 1000, delay: featured && podium ? (arrival - flightDuration) * 1000 : featured && returning ? flightDuration * 1000 : 0, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" },
				);
				const restore = () => {
					node.removeAttribute("style");
					slot.style.height = "";
				};
				animation.onfinish = () => {
					restore();
					animation.cancel();
				};
				flights.push({ animation, node, slot });
			}
		previous.current = new Map(targets.map(({ node, box, featured, stacked }) => [node.dataset.awardFlight!, { box, featured, stacked }]));
		return () => {
			for (const node of nodes) {
				const box = node.getBoundingClientRect();
				if (box.width) previous.current.set(node.dataset.awardFlight!, { box, featured: node.dataset.featured === "true", stacked: node.dataset.stacked === "true" });
			}
			for (const { animation, node, slot } of flights) {
				animation.cancel();
				node.removeAttribute("style");
				slot.style.height = "";
			}
		};
	}, [category.id, position, place, immediate, podium, arrival]);
	function card(candidate: Category["candidates"][number], featured: boolean, stacked = false) {
		const entry = ranked.find((entry) => entry.candidate.id === candidate.id);
		const visible = reveal && (final || (!!entry?.place && ((place ?? 0) > 1 || cue) && entry.place >= (place ?? 0) + (cue ? 1 : 0) && entry.place <= 3));
		const newlyRevealed = activeIds.has(candidate.id) || (final && (!entry?.place || entry.place > 3));
		return (
			<div data-award-flight={candidate.id} data-featured={featured} data-stacked={stacked}>
				<EventNomineeCard presentation stacked={stacked} candidate={candidate} compact={!featured} rank={visible ? (entry?.place ?? undefined) : undefined} result={dataWinnerId === candidate.id && final ? { winner: true } : visible ? entry?.result : undefined} resultDelay={!immediate && visible && newlyRevealed ? arrival + 0.05 : undefined} onOpen={() => onOpen(candidate.content)} />
			</div>
		);
	}
	function focus(candidate: Category["candidates"][number]) {
		return (
			<div key={candidate.id} className={`w-full space-y-2 ${drawing ? "max-w-[var(--award-focus-width)]" : "max-w-[min(24rem,38dvh)] min-[120rem]:max-w-[min(36rem,44dvh)] [@media(max-height:800px)]:max-w-[min(24rem,32dvh)]"}`}>
				<motion.div key={place ?? "nominee"} data-award-placement initial={!immediate && podium ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ delay: immediate ? 0 : arrival, duration: 0.25 }} className={`flex h-10 items-center justify-center gap-3 text-center font-bold tracking-tight ${final ? "text-warning" : place === 2 ? "text-foreground" : place === 3 ? "text-[#cd7f32]" : "text-foreground"} ${final ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"}`}>
					{reveal && place ? (
						<>
							{final ? <IconTrophy aria-hidden='true' className='size-8 shrink-0 text-warning' /> : null}
							<span role='heading' aria-level={2}>
								{final ? "First place" : place === 2 ? "Second place" : "Third place"}
							</span>
						</>
					) : null}
				</motion.div>
				{card(candidate, true)}
			</div>
		);
	}

	return (
		<motion.div
			ref={stage}
			initial={immediate || position !== 0 ? false : { opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ delay: immediate || position !== 0 ? 0 : 0.5, duration: 0.2 }}
			className='mx-auto w-full max-w-6xl min-[120rem]:max-w-none space-y-6 [--award-stack-width:clamp(8rem,14vw,12rem)] [--award-podium-width:min(11rem,24dvh)] [--award-focus-width:min(18rem,28dvh)] min-[120rem]:[--award-stack-width:18rem] min-[120rem]:[--award-podium-width:min(22rem,24dvh)] min-[120rem]:[--award-focus-width:min(24rem,36dvh)]'
		>
			{/* Keep the draw stack separate from the currently featured, keyboard-playable card. */}
			<div className='relative'>
				{drawing ? (
					<aside aria-label='Nominee draw stack' className='absolute inset-y-0 left-0 z-10 flex w-[var(--award-stack-width)] flex-col gap-2 overflow-x-hidden overflow-y-auto pr-1'>
						{waiting.map((candidate) => (
							<div key={candidate.id} className='shrink-0'>
								{card(candidate, false, true)}
							</div>
						))}
					</aside>
				) : null}
				<div data-award-featured aria-label={reveal ? (final && active.length && !drawing ? "Award winners" : "Featured nominee") : "Category nominees"} className={`relative flex ${drawing ? "[min-height:calc(var(--award-focus-width)*9/16+11rem)]" : "min-h-[min(24rem,42dvh)] min-[120rem]:min-h-[calc(min(36rem,44dvh)*9/16+11rem)]"} items-center justify-center gap-5 ${drawing ? "ml-auto w-[calc(100%_-_var(--award-stack-width)_-_1rem)] lg:mx-auto lg:w-full" : "mx-auto w-full"}`}>
					{podium && !(drawing && final) ? <EventPodiumCelebration key={`${category.id}:${place}`} place={place!} immediate={immediate} arrival={arrival} cueStart={flightDuration} cueDuration={cueDuration} announced={cue === false} /> : null}
					{cue ? <EventPodiumCelebration key={`cue:${category.id}:${place}`} place={place!} immediate={immediate} arrival={0} cueStart={flightDuration} cueDuration={0} cueOnly /> : null}
					<div className='relative flex w-full items-center justify-center gap-5'>
						{(drawing && final ? [] : active).map(focus)}
						{reveal && !cue && !active.length ? <p className='text-center text-muted'>{place === 0 ? "Let’s reveal the results" : ranked.some(({ result }) => result.votes > 0) ? "The results" : "No votes were cast."}</p> : null}
					</div>
				</div>
			</div>
			{drawing ? (
				<div aria-label='Nominee results' data-award-podium-scroll className='w-full overflow-x-auto pt-10 -mt-18'>
					<div className='mx-auto grid min-w-[40rem] w-full max-w-3xl grid-cols-[1fr_1.4fr_1fr] items-end gap-3 pt-2 pb-1 min-[120rem]:max-w-7xl'>
						{[3, 1, 2].map((rank) => (
							<div key={rank} data-award-podium-slot={rank} style={{ position: "relative", top: rank === 1 ? -40 : rank === 2 ? -20 : 0 }} className='flex min-w-0 flex-col items-center gap-3'>
								<div aria-label={rank === 1 && final && active.length ? "Award winners" : undefined} className={`relative w-full ${rank === 1 ? "max-w-[var(--award-focus-width)] [min-height:calc(var(--award-focus-width)*9/16+10.75rem)]" : "max-w-[var(--award-podium-width)] [min-height:calc(var(--award-podium-width)*9/16+7.75rem)]"}`}>
									{rank === 1 && final && podium ? <EventPodiumCelebration place={1} immediate={immediate} arrival={arrival} cueStart={flightDuration} cueDuration={cueDuration} announced /> : null}
									<div aria-hidden='true' className={`pointer-events-none absolute inset-x-0 bottom-0 rounded-2xl border bg-surface/20 ${rank === 1 ? "top-12 border-warning/30" : rank === 2 ? "top-0 border-[#b8c5d6]/40" : "top-0 border-[#cd7f32]/40"}`} />
									{rank === 1 ? (
										final ? (
											active.map(focus)
										) : (
											<span aria-hidden='true' className='absolute inset-0 flex items-center justify-center text-xl font-semibold text-muted/50'>
												1
											</span>
										)
									) : settled.filter((entry) => entry.place === rank).length ? (
										settled
											.filter((entry) => entry.place === rank)
											.map(({ candidate }) => (
												<div key={candidate.id} data-award-slot={candidate.id} data-award-settled={rank} className='w-full'>
													{card(candidate, false)}
												</div>
											))
									) : (
										<span aria-hidden='true' className='absolute inset-0 flex items-center justify-center text-xl font-semibold text-muted/50'>
											{rank}
										</span>
									)}
								</div>
							</div>
						))}
					</div>
				</div>
			) : category.presenterMode !== "winner" ? (
				<div aria-label={reveal ? "Nominee results" : "Presented nominees"} className='flex w-full items-end gap-3 overflow-x-auto pt-6 pb-1 lg:justify-center'>
					{candidates.map((candidate, index) => {
						const presented = reveal || index < (position ?? 0);
						return (
							<div key={candidate.id} data-award-slot={candidate.id} className={`w-40 shrink-0 sm:w-44 lg:w-[calc((100%-3.75rem)/6)] min-[120rem]:w-[clamp(11rem,calc((100%_-_3.75rem)/6),min(22rem,24dvh))] [@media(max-height:800px)]:w-40 ${!presented && !activeIds.has(candidate.id) ? "hidden lg:block" : ""}`}>
								{presented && !activeIds.has(candidate.id) ? (
									card(candidate, false)
								) : (
									<div aria-hidden='true' className='invisible h-full rounded-2xl border border-transparent'>
										<div className='aspect-video' />
										<div className='h-[7.25rem]' />
									</div>
								)}
							</div>
						);
					})}
				</div>
			) : null}
		</motion.div>
	);
}
