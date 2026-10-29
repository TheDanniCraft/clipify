import type { ReactNode } from "react";

export default function PublicPageHeader({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
	return (
		<header className='mb-12 border-b border-separator pb-10 sm:mb-16'>
			<h1 className='max-w-4xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl'>{title}</h1>
			<p className='mt-5 max-w-2xl text-lg leading-relaxed text-foreground/75'>{description}</p>
			{children}
		</header>
	);
}
