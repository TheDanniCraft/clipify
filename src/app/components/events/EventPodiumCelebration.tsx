"use client";
import { motion } from "motion/react";
import { IconTrophy } from "@tabler/icons-react";

export default function EventPodiumCelebration({ place, immediate, arrival, cueStart, cueDuration, cueOnly = false, announced = false }: { place: number; immediate: boolean; arrival: number; cueStart: number; cueDuration: number; cueOnly?: boolean; announced?: boolean }) {
	const winner = place === 1;
	const lightMask = "radial-gradient(ellipse closest-side at center, black 30%, transparent 100%)";
	const color = winner ? "#f4bc4a" : place === 2 ? "#b8c5d6" : "#cd7f32";
	return (
		<>
			{!cueOnly ? (
				<div aria-hidden='true' data-award-podium={place} className='pointer-events-none absolute inset-x-0 -top-8 -bottom-16 overflow-hidden' style={{ maskImage: lightMask, WebkitMaskImage: lightMask }}>
					<motion.div initial={immediate ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: immediate ? 0 : arrival, duration: 0.45 }} className='absolute -inset-x-12 -inset-y-8' style={{ background: `radial-gradient(ellipse at 50% 50%, color-mix(in srgb, ${color} 25%, transparent), transparent 65%)` }} />
				</div>
			) : null}
			{cueOnly || (!immediate && !announced) ? (
				<motion.div
					aria-hidden={cueOnly ? undefined : true}
					role={cueOnly ? "status" : undefined}
					key={`cue:${place}`}
					data-award-podium-cue
					initial={{ opacity: 0, scale: 0.92 }}
					animate={cueOnly ? { opacity: 1, scale: 1 } : { opacity: [0, 1, 1, 0], scale: [0.92, 1, 1, 1.04] }}
					transition={cueOnly ? { delay: immediate ? 0 : cueStart, duration: immediate ? 0 : 0.2 } : { delay: cueStart, duration: cueDuration, times: [0, 0.15, 0.7, 1] }}
					className='pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 text-center'
				>
					<div className='flex size-28 items-center justify-center rounded-full border-2 text-7xl text-foreground font-bold shadow-lg sm:size-36 sm:text-8xl' style={{ borderColor: color, background: `color-mix(in srgb, ${color} 10%, var(--color-background))` }}>
						{winner ? <IconTrophy className='size-16 text-warning sm:size-20' /> : place}
					</div>
					<p className='text-2xl font-bold tracking-tight sm:text-4xl'>{winner ? "And the award goes to…" : place === 2 ? "Second place" : "Third place"}</p>
				</motion.div>
			) : null}
			{winner && !immediate && !cueOnly ? (
				<div aria-hidden='true' data-award-confetti className='pointer-events-none absolute z-30 inset-0 overflow-hidden'>
					{Array.from({ length: 28 }, (_, i) => (
						<motion.span
							key={i}
							initial={{ x: 0, y: 0, rotate: 0, opacity: 0 }}
							animate={{ x: [0, ((i * 137) % 700) - 350], y: [0, -100 - (i % 4) * 15, 320], rotate: [0, ((i * 83) % 720) - 360], opacity: [0, 1, 1, 0] }}
							transition={{ delay: arrival + 0.12 + (i % 4) * 0.025, duration: 2.4, ease: "easeOut", y: { delay: arrival + 0.12 + (i % 4) * 0.025, duration: 2.4, times: [0, 0.25, 1] }, opacity: { delay: arrival + 0.12 + (i % 4) * 0.025, duration: 2.4, times: [0, 0.1, 0.8, 1] } }}
							className='absolute left-1/2 top-1/4 h-3 w-1.5 rounded-sm'
							style={{ backgroundColor: [color, "var(--color-accent)", "#fff1bb"][i % 3] }}
						/>
					))}
				</div>
			) : null}
		</>
	);
}
