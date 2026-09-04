"use client";

import Logo from "@components/logo";
import type { MemberProfile } from "@lib/membership";
import { formatMemberNumber, formatMemberSince } from "@lib/membershipFormat";
import { memberAvatarUrl } from "@lib/memberCardLinks";
import { useRef, useState, type PointerEvent } from "react";
import styles from "./MemberCard.module.css";

export default function MemberCard({ profile }: { profile: MemberProfile }) {
	const featuredBadge = profile.badges[0]?.name ?? "Clipify Member";
	const cardRef = useRef<HTMLElement>(null);
	const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
	const avatar = memberAvatarUrl(profile.avatar);

	function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || event.pointerType === "touch") return;
		const card = cardRef.current;
		if (!card) return;
		// Measure the stationary wrapper, not the rotating card, to avoid jitter.
		const rect = event.currentTarget.getBoundingClientRect();
		if (!rect.width || !rect.height) return;
		const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
		const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
		card.style.setProperty("--pointer-x", `${x * 100}%`);
		card.style.setProperty("--pointer-y", `${y * 100}%`);
		card.style.setProperty("--rotate-x", `${(0.5 - y) * 14}deg`);
		card.style.setProperty("--rotate-y", `${(x - 0.5) * 16}deg`);
		card.dataset.active = "true";
	}

	function resetTilt() {
		const card = cardRef.current;
		if (!card) return;
		card.dataset.active = "false";
		card.style.setProperty("--rotate-x", "0deg");
		card.style.setProperty("--rotate-y", "0deg");
	}

	return (
		<div className={styles.stage} onPointerMove={handlePointerMove} onPointerLeave={resetTilt} onPointerCancel={resetTilt}>
			<article ref={cardRef} className={styles.card} aria-label={`${profile.username}'s Clipify Member Card`}>
				<div aria-hidden='true' className={styles.foil} />
				<div aria-hidden='true' className={styles.symbols} />
				<div aria-hidden='true' className={styles.glare} />
				<div className={styles.content}>
					<div className='flex items-center justify-between gap-3'>
						<div className='flex items-center gap-2.5 text-lg font-bold tracking-tight'>
							<Logo size={32} aria-hidden='true' />
							Clipify
						</div>
						<span className={styles.edition}>MEMBER CARD</span>
					</div>

					<div className={styles.identity}>
						<div className={styles.avatarRing}>
							{avatar && failedAvatar !== avatar ? (
								// eslint-disable-next-line @next/next/no-img-element -- Small Twitch avatar; same source is used by the export renderer.
								<img src={avatar} alt={`${profile.username}'s avatar`} width={96} height={96} onError={() => setFailedAvatar(avatar)} draggable={false} className={styles.avatar} />
							) : (
								<span className={styles.avatarFallback} aria-label={`${profile.username}'s avatar`}>
									{profile.username.slice(0, 2).toUpperCase()}
								</span>
							)}
						</div>
						<p className={styles.username} title={profile.username}>
							{profile.username}
						</p>
						<p className={styles.badge}>{featuredBadge}</p>
					</div>

					<div>
						<div className={styles.rule} />
						<dl className='grid grid-cols-2 gap-3'>
							<div>
								<dt className={styles.label}>Joined</dt>
								<dd className={styles.value}>{formatMemberSince(profile.joinedAt)}</dd>
							</div>
							<div className='text-right'>
								<dt className={styles.label}>Member</dt>
								<dd className={styles.value}>{formatMemberNumber(profile.memberNumber)}</dd>
							</div>
						</dl>
						<p className={styles.footer}>YOUR MOMENTS. YOUR COMMUNITY.</p>
					</div>
				</div>
			</article>
		</div>
	);
}
