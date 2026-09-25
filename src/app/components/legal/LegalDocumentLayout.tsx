import type { ReactNode } from "react";
import Image from "next/image";
import type { LegalDocumentManifestEntry } from "@lib/legal/documents";
import LegalDocumentTabs from "./LegalDocumentTabs";

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
		<main className='min-h-screen bg-background text-foreground'>
			<header className='border-b border-default bg-background'>
				<div className='mx-auto grid max-w-4xl items-end gap-6 px-6 pb-10 pt-10 sm:grid-cols-[1fr_auto] sm:pt-12'>
					<div className='space-y-4'>
						<p className='text-sm font-semibold uppercase tracking-[0.2em] text-muted'>Legal information</p>
						<h1 className='text-4xl font-bold sm:text-5xl'>{document.title}</h1>
						<p className='max-w-2xl text-base text-muted sm:text-lg'>{document.description}</p>
						<div className='flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted'>
							<span>Version {document.version}</span>
							<span>Effective {formatLegalDate(document.effectiveDate)}</span>
						</div>
					</div>
					<Image src='/clippy/Clippy.svg' alt='Clippy mascot' width={144} height={144} className='h-24 w-24 sm:h-36 sm:w-36' />
				</div>
			</header>
			<div className='mx-auto w-full max-w-4xl px-6 pt-6'>
				<LegalDocumentTabs activeDocumentId={document.id}>
					<article className='py-10 text-[15px] leading-7 sm:py-14 sm:text-base'>{children}</article>
				</LegalDocumentTabs>
			</div>
		</main>
	);
}
