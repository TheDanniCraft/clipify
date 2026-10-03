import type { LegalDocumentSection } from "@lib/legal/documents";

const EMAIL_PATTERN = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;

function linkedText(value: string) {
	return value.split(EMAIL_PATTERN).map((part, index) =>
		part.includes("@") ? (
			<a key={`${part}-${index}`} className='font-medium text-primary underline decoration-primary/60 underline-offset-4 hover:decoration-primary' href={`mailto:${part}`}>
				{part}
			</a>
		) : (
			part
		),
	);
}

export default function LegalSections({ sections }: { sections: readonly LegalDocumentSection[] }) {
	return (
		<div className='space-y-10'>
			{sections.map((section) => (
				<section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className='border-b border-default pb-9 last:border-b-0 last:pb-0'>
					<h2 id={`${section.id}-title`} className='text-2xl font-semibold tracking-tight'>
						{section.title}
					</h2>
					<div className='mt-3 max-w-3xl space-y-3 leading-7 text-foreground/75'>
						<p>{linkedText(section.summary)}</p>
						{section.details?.map((paragraph) => (
							<p key={paragraph}>{linkedText(paragraph)}</p>
						))}
						{section.items?.length ? (
							<ul className='list-disc space-y-2 pl-6'>
								{section.items.map((item) => (
									<li key={item}>{linkedText(item)}</li>
								))}
							</ul>
						) : null}
						{section.links?.length ? (
							<div>
								<p className='font-medium text-foreground'>{section.linkHeading ?? "Related links"}</p>
								<ul className='mt-1 list-disc space-y-1 pl-6'>
									{section.links.map((link) => (
										<li key={link.href}>
											<a className='font-medium text-primary underline decoration-primary/60 underline-offset-4 hover:decoration-primary' href={link.href}>
												{link.label}
											</a>
										</li>
									))}
								</ul>
							</div>
						) : null}
					</div>
				</section>
			))}
		</div>
	);
}
