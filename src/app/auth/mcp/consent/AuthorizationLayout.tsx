"use client";
import type { ReactNode } from "react";
import { Link } from "@heroui/react";
import { IconPlugConnected } from "@tabler/icons-react";

export function AuthorizationLayout({ children }: { children: ReactNode }) {
	return (
		<main className='flex min-h-dvh items-center justify-center bg-background px-4 py-8 sm:py-12'>
			<div className='mx-auto flex w-full max-w-2xl flex-col gap-6'>
				<header className='flex items-center gap-3 text-accent'>
					<span className='flex size-10 items-center justify-center rounded-xl bg-accent-soft'>
						<IconPlugConnected size={22} aria-hidden='true' />
					</span>
					<span className='font-semibold'>Clipify · App connection</span>
				</header>
				{children}
				<footer className='flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted'>
					<Link href='/legal/privacy' className='text-xs'>
						Privacy
					</Link>
					<Link href='/legal/terms' className='text-xs'>
						Terms
					</Link>
					<Link href='https://docs.clipify.us' className='text-xs' target='_blank' rel='noreferrer'>
						Help
					</Link>
				</footer>
			</div>
		</main>
	);
}
