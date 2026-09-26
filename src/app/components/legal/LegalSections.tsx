import type { LegalDocumentSection } from "@lib/legal/documents";

export default function LegalSections({ sections }: { sections: readonly LegalDocumentSection[] }) {
	return (
		<div className='space-y-10'>
			{sections.map((section) => (
				<section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className='border-b border-default pb-9 last:border-b-0 last:pb-0'>
					<h2 id={`${section.id}-title`} className='text-2xl font-semibold tracking-tight'>
						{section.title}
					</h2>
					<div className='mt-3 max-w-3xl space-y-3 leading-7 text-foreground/75'>
						<p>{section.summary}</p>
						{section.details?.map((paragraph) => (
							<p key={paragraph}>{paragraph}</p>
						))}
						{section.items?.length ? (
							<ul className='list-disc space-y-2 pl-6'>
								{section.items.map((item) => (
									<li key={item}>{item}</li>
								))}
							</ul>
						) : null}
					</div>
				</section>
			))}
		</div>
	);
}
