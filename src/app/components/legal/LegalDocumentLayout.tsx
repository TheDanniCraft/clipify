import type { ReactNode } from "react";
import Link from "next/link";
import { legalDocuments, type LegalDocumentManifestEntry } from "@lib/legal/documents";

type LegalDocumentLayoutProps = {
	document: LegalDocumentManifestEntry;
	children: ReactNode;
};

function formatLegalDate(value: string) {
	return new Intl.DateTimeFormat("en-US", {
		dateStyle: "long",
		timeZone: "UTC",
	}).format(new Date(`${value}T00:00:00Z`));
}

export default function LegalDocumentLayout({ document, children }: LegalDocumentLayoutProps) {
	return (
		<main className='mx-auto min-h-screen w-full max-w-5xl px-6 py-12 sm:px-8 lg:py-16'>
			<nav aria-label='Legal documents' className='mb-8 flex flex-wrap gap-2 text-sm'>
				{legalDocuments.map((item) => (
					<Link key={item.id} href={item.route} aria-current={item.id === document.id ? "page" : undefined} className='rounded-full border border-white/10 bg-content1/60 px-4 py-2 text-foreground/70 transition-colors hover:border-primary/40 hover:text-foreground aria-[current=page]:border-primary/50 aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary'>
						{item.title}
					</Link>
				))}
			</nav>
			<header className='relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/20 via-content1 to-content1 px-6 py-10 shadow-xl shadow-primary/5 sm:px-10 sm:py-12'>
				<div aria-hidden='true' className='absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl' />
				<div className='relative'>
					<p className='text-sm font-semibold uppercase tracking-[0.2em] text-primary'>Clipify legal</p>
					<h1 className='mt-3 text-4xl font-semibold tracking-tight sm:text-5xl'>{document.title}</h1>
					<p className='mt-4 max-w-2xl text-base leading-7 text-foreground/75 sm:text-lg'>{document.description}</p>
					<div className='mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-foreground/60'>
						<span>Version {document.version}</span>
						<span>Effective {formatLegalDate(document.effectiveDate)}</span>
					</div>
				</div>
			</header>
			<article className='py-12'>{children}</article>
		</main>
	);
}
