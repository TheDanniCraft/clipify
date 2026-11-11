"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { PublicAwardEvent } from "@lib/eventPublicView";
import { rankAwardNominees } from "@lib/eventPresenter";
import type { EventCandidateContent } from "@lib/eventCandidates";
import { EventNomineeCard } from "./EventMedia";

type Category = PublicAwardEvent["categories"][number];

export default function EventNomineeStage({ category, position, place, onOpen, instant = false }: { category: Category; position?: number; place?: number; onOpen: (content: EventCandidateContent) => void; instant?: boolean }) {
	const reduceMotion = useReducedMotion();
	const immediate = instant || !!reduceMotion;
	const reveal = place !== undefined;
	const final = place === 1;
	const candidates = [...category.candidates].sort((a, b) => a.id.localeCompare(b.id));
	const ranked = rankAwardNominees(category);
	const dataWinnerId = category.selection === "data" ? category.candidates[0]?.id : undefined;
	const featured = reveal ? ranked.filter((entry) => (final ? entry.result.winner : place !== 0 && entry.place === place)) : [];
	const activeIds = new Set(reveal ? (dataWinnerId && final ? [dataWinnerId] : featured.map(({ candidate }) => candidate.id)) : candidates.slice(position, (position ?? 0) + 1).map(({ id }) => id));
	const active = candidates.filter(({ id }) => activeIds.has(id));
	function card(candidate: Category["candidates"][number], featured: boolean) {
		const entry = ranked.find((entry) => entry.candidate.id === candidate.id);
		const visible = reveal && (final || (!!entry?.place && (place ?? 0) > 1 && entry.place >= (place ?? 0) && entry.place <= 3));
		const newlyRevealed = activeIds.has(candidate.id) || (final && (!entry?.place || entry.place > 3));
		return <EventNomineeCard presentation candidate={candidate} compact={!featured} rank={visible ? (entry?.place ?? undefined) : undefined} result={dataWinnerId === candidate.id && final ? { winner: true } : visible ? entry?.result : undefined} resultDelay={!immediate && visible && newlyRevealed ? 0.4 : undefined} onOpen={() => onOpen(candidate.content)} />;
	}
	return (
		<motion.div initial={immediate || position !== 0 ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: immediate || position !== 0 ? 0 : 0.5, duration: 0.2 }} className='mx-auto w-full max-w-6xl space-y-6'>
			<div data-award-featured aria-label={reveal ? (final && active.length ? "Award winners" : "Featured nominee") : "Category nominees"} className='mx-auto flex min-h-[min(24rem,42dvh)] w-full items-center justify-center gap-5'>
				<AnimatePresence mode='wait' initial={false}>
					<motion.div key={`${position ?? "reveal"}:${place ?? "nominee"}:${active.map(({ id }) => id).join(":")}`} initial={immediate ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={immediate ? { opacity: 1 } : { opacity: 0, y: -8 }} transition={{ duration: immediate ? 0 : 0.2, ease: "easeOut" }} className='flex w-full items-center justify-center gap-5'>
						{active.map((candidate) => (
							<div key={candidate.id} className='w-full max-w-[min(24rem,38dvh)] [@media(max-height:800px)]:max-w-[min(24rem,32dvh)] space-y-2'>
								<div className='h-6 text-center text-sm font-semibold tracking-wide text-accent'>{reveal && place ? (final ? "Winner" : place === 2 ? "Second place" : "Third place") : null}</div>
								{card(candidate, true)}
							</div>
						))}
						{reveal && !active.length ? <p className='text-center text-muted'>{place === 0 ? "And the award goes to…" : ranked.some(({ result }) => result.votes > 0) ? "The results" : "No votes were cast."}</p> : null}
					</motion.div>
				</AnimatePresence>
			</div>
			{category.presenterMode !== "winner" ? (
				<div aria-label={reveal ? "Nominee results" : "Presented nominees"} className='flex w-full items-stretch gap-3 overflow-x-auto pb-1 lg:justify-center'>
					{candidates.map((candidate, index) => {
						const presented = reveal || index <= (position ?? 0);
						return (
							<div key={candidate.id} data-award-slot={candidate.id} className={`w-40 shrink-0 sm:w-44 lg:w-[calc((100%-3.75rem)/6)] [@media(max-height:800px)]:w-40 ${!presented ? "hidden lg:block" : ""}`}>
								{presented ? (
									card(candidate, false)
								) : (
									<div aria-hidden='true' className='invisible h-full rounded-2xl border border-transparent'>
										<div className='aspect-video' />
										<div className='h-[6.25rem]' />
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
