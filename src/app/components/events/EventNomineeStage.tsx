"use client";
import { useId } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import type { PublicAwardEvent } from "@lib/eventPublicView";
import { rankAwardNominees } from "@lib/eventPresenter";
import type { EventCandidateContent } from "@lib/eventCandidates";
import { EventNomineeCard } from "./EventMedia";

type Category = PublicAwardEvent["categories"][number];

export default function EventNomineeStage({ category, position, place, onOpen }: { category: Category; position?: number; place?: number; onOpen: (content: EventCandidateContent) => void }) {
	const id = useId();
	const reduceMotion = useReducedMotion();
	const reveal = place !== undefined;
	const final = place === 1;
	const candidates = [...category.candidates].sort((a, b) => a.id.localeCompare(b.id));
	const ranked = rankAwardNominees(category);
	const dataWinnerId = category.selection === "data" ? category.candidates[0]?.id : undefined;
	const featured = reveal ? ranked.filter((entry) => (final ? entry.result.winner : place !== 0 && entry.place === place)) : [];
	const activeIds = new Set(reveal ? (dataWinnerId && final ? [dataWinnerId] : featured.map(({ candidate }) => candidate.id)) : candidates.slice(position, (position ?? 0) + 1).map(({ id }) => id));

	function card(candidate: Category["candidates"][number], active: boolean) {
		const entry = ranked.find((entry) => entry.candidate.id === candidate.id);
		const visible = reveal && (final || (!!entry?.place && (place ?? 0) > 1 && entry.place >= (place ?? 0) && entry.place <= 3));
		return (
			<motion.div layoutId={reduceMotion ? undefined : candidate.id} initial={false} transition={{ layout: { duration: reduceMotion ? 0 : 0.7, delay: active && !reduceMotion ? 0.7 : 0, ease: [0.22, 1, 0.36, 1] } }} style={{ borderRadius: 16 }} className='w-full'>
				<EventNomineeCard candidate={candidate} compact={!active} rank={visible ? (entry?.place ?? undefined) : undefined} result={dataWinnerId === candidate.id && final ? { winner: true } : visible ? entry?.result : undefined} resultDelay={visible && (active || final) ? (active ? 1.4 : 0.15) : undefined} onOpen={() => onOpen(candidate.content)} />
			</motion.div>
		);
	}
	const active = candidates.filter(({ id }) => activeIds.has(id));
	return (
		<LayoutGroup id={id}>
			<motion.div initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.2 }} className='mx-auto w-full max-w-6xl space-y-6'>
				<div data-award-featured aria-label={reveal ? (final && active.length ? "Award winners" : "Featured nominee") : "Category nominees"} className='mx-auto flex min-h-[min(22rem,44dvh)] w-full items-center justify-center gap-5'>
					{active.map((candidate) => (
						<div key={candidate.id} className='w-full max-w-[min(24rem,38dvh)]'>
							{card(candidate, true)}
						</div>
					))}
					{reveal && !active.length ? <p className='text-center text-muted'>{place === 0 ? "And the award goes to…" : ranked.some(({ result }) => result.votes > 0) ? "The results" : "No votes were cast."}</p> : null}
				</div>
				{category.presenterMode !== "winner" ? (
					<div aria-label={reveal ? "Nominee results" : "Previously presented nominees"} className='flex w-full flex-wrap items-stretch justify-center gap-3'>
						{candidates.map((candidate, index) => {
							const presented = reveal || index < (position ?? 0);
							return (
								<div key={candidate.id} data-award-slot={candidate.id} className={`w-[calc((100%-0.75rem)/2)] sm:w-[calc((100%-1.5rem)/3)] lg:w-[calc((100%-3.75rem)/6)] ${!presented ? "hidden lg:block" : ""}`}>
									{presented && !activeIds.has(candidate.id) ? (
										card(candidate, false)
									) : (
										<div aria-hidden='true' className={`h-full rounded-2xl ${activeIds.has(candidate.id) && reveal ? "border border-dashed border-accent/30 bg-accent/5" : "invisible border border-transparent"}`}>
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
		</LayoutGroup>
	);
}
