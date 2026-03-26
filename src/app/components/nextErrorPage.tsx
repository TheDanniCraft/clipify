"use client";

import { Button, Chip, Link } from "@heroui/react";
import Image from "next/image";
import type { ReactNode } from "react";

type NextErrorPageProps = {
	contextLabel: string;
	code?: string;
	title: string;
	description: string;
	actions?: ReactNode;
	showHomeAction?: boolean;
};

export default function NextErrorPage({ contextLabel, code, title, description, actions, showHomeAction = true }: NextErrorPageProps) {
	const showContextBadge = contextLabel.trim().toLowerCase() !== title.trim().toLowerCase();

	return (
		<main className='relative min-h-screen overflow-hidden bg-linear-to-br from-primary-800 to-primary-400 text-white'>
			<div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_50%,rgba(255,255,255,0.08),transparent_42%),radial-gradient(circle_at_78%_38%,rgba(255,255,255,0.14),transparent_36%),radial-gradient(circle_at_50%_105%,rgba(9,12,26,0.85),transparent_40%)]' />
			<div className='relative mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 items-center gap-10 px-6 py-10 md:px-10 lg:grid-cols-2 lg:gap-16'>
				<section className='order-2 space-y-6 text-center lg:order-1 lg:text-left'>
					{showContextBadge ? (
						<Chip size='sm' variant='flat' className='mx-auto border border-white/30 bg-white/15 text-white lg:mx-0'>
							{contextLabel}
						</Chip>
					) : null}
					{code ? <p className='font-mono text-5xl font-bold tracking-[0.16em] text-white/95 md:text-7xl'>{code}</p> : null}
					<h1 className='text-3xl font-semibold tracking-wide md:text-5xl'>{title}</h1>
					<p className='mx-auto max-w-xl text-base text-white/80 lg:mx-0'>{description}</p>
					<div className='flex flex-wrap items-center justify-center gap-3 lg:justify-start'>
						{actions}
						{showHomeAction ? (
							<Button as={Link} href='/' variant='bordered' className='border-white/65 text-white'>
								Go home
							</Button>
						) : null}
					</div>
					<p className='text-xs text-white/65'>If this keeps happening, please contact support and include what you were doing.</p>
				</section>

				<section className='order-1 flex items-center justify-center lg:order-2'>
					<div className='relative'>
						<div className='absolute -inset-14 rounded-full bg-white/30 blur-3xl' />
						<div className='absolute -inset-4 rounded-full border border-white/10' />
						<Image src='/clippy/Clippy.svg' alt='Clippy' width={320} height={320} className='relative h-56 w-56 md:h-80 md:w-80' />
					</div>
				</section>
			</div>
		</main>
	);
}
