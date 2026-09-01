"use client";

import type { MemberProfile } from "@lib/membership";
import { formatMemberNumber, formatMemberSince } from "@lib/membershipFormat";
import { IconSparkles } from "@tabler/icons-react";
import { useRef } from "react";

export default function MemberCard({ profile }: { profile: MemberProfile }) {
	const featuredBadge = profile.badges[0]?.name ?? "Clipify Member";
	const cardRef = useRef<HTMLElement>(null);
	const glareRef = useRef<HTMLDivElement>(null);

	function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || event.pointerType === "touch") return;
		const card = cardRef.current;
		if (!card) return;
		const rect = card.getBoundingClientRect();
		const x = (event.clientX - rect.left) / rect.width;
		const y = (event.clientY - rect.top) / rect.height;
		const rotateY = (x - 0.5) * 16;
		const rotateX = (0.5 - y) * 14;
		card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px) scale(1.015)`;
		if (glareRef.current) {
			glareRef.current.style.opacity = "0.75";
			glareRef.current.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.32), rgba(125,211,252,0.1) 24%, transparent 52%)`;
		}
	}

	function resetTilt() {
		if (cardRef.current) cardRef.current.style.transform = "rotateX(0deg) rotateY(0deg) translateY(0) scale(1)";
		if (glareRef.current) glareRef.current.style.opacity = "0";
	}

	return (
		<div className='group relative w-full max-w-[360px] [perspective:1400px]'>
			<div aria-hidden='true' className='absolute inset-x-8 -bottom-8 h-20 rounded-full bg-cyan-400/20 blur-3xl transition-opacity duration-500 group-hover:opacity-100' />
			<article
				ref={cardRef}
				onPointerMove={handlePointerMove}
				onPointerLeave={resetTilt}
				onPointerCancel={resetTilt}
				className='relative aspect-[0.68] w-full cursor-default overflow-hidden rounded-[2rem] border border-white/15 bg-[#11131a] p-7 text-white shadow-[0_34px_100px_-30px_rgba(34,211,238,0.5),0_18px_48px_-28px_rgba(99,102,241,0.65)] transition-[transform,box-shadow] duration-500 ease-out [transform-style:preserve-3d] will-change-transform motion-reduce:transform-none motion-safe:group-hover:shadow-[0_46px_130px_-32px_rgba(34,211,238,0.65),0_24px_64px_-30px_rgba(99,102,241,0.8)]'
			>
				<div aria-hidden='true' className='absolute inset-0 bg-[radial-gradient(circle_at_18%_5%,rgba(79,70,229,0.38),transparent_32%),radial-gradient(circle_at_88%_88%,rgba(34,211,238,0.22),transparent_34%),linear-gradient(145deg,rgba(255,255,255,0.08),transparent_45%)]' />
				<div aria-hidden='true' className='absolute inset-0 opacity-30 [background-image:linear-gradient(115deg,transparent_20%,rgba(255,255,255,0.12)_36%,transparent_52%)] [background-size:220%_100%] transition-[background-position] duration-700 group-hover:[background-position:100%_0]' />
				<div aria-hidden='true' className='absolute inset-[6px] rounded-[1.7rem] border border-white/8' />
				<div aria-hidden='true' className='absolute -right-24 top-1/3 h-52 w-52 rounded-full bg-accent/20 blur-3xl' />
				<div ref={glareRef} aria-hidden='true' className='pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300' />

				<div className='relative flex h-full flex-col [transform:translateZ(34px)]'>
					<div className='flex items-center gap-2 text-sm font-semibold tracking-tight text-white/80 [transform:translateZ(18px)]'>
						<span className='flex size-7 items-center justify-center rounded-lg bg-white/10'>
							<IconSparkles aria-hidden='true' size={16} />
						</span>
						Clipify
					</div>

					<div className='my-auto text-center [transform:translateZ(54px)]'>
						<p className='truncate text-3xl font-bold tracking-tight'>{profile.username}</p>
						<p className='mt-1 text-xs font-medium uppercase tracking-[0.2em] text-white/50'>{featuredBadge}</p>
					</div>

					<dl className='grid grid-cols-2 gap-5 [transform:translateZ(24px)]'>
						<div>
							<dt className='text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/40'>Joined</dt>
							<dd className='mt-1 text-sm font-semibold text-white/85'>{formatMemberSince(profile.joinedAt, profile.memberNumber)}</dd>
						</div>
						<div className='text-right'>
							<dt className='text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/40'>Member</dt>
							<dd className='mt-1 text-sm font-semibold text-white/85'>{formatMemberNumber(profile.memberNumber)}</dd>
						</div>
					</dl>
				</div>
			</article>
		</div>
	);
}
