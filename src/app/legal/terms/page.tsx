import type { Metadata } from "next";
import LegalDocumentLayout from "@components/legal/LegalDocumentLayout";
import { legalDocuments } from "@lib/legal/documents";
import { termsSections } from "@lib/legal/terms";

const termsDocument = legalDocuments.find(({ id }) => id === "terms")!;

export const metadata: Metadata = {
	title: "Terms of Service | Clipify",
	description: "The terms that apply when using Clipify and the self-hosted Runner.",
};

export default function TermsPage() {
	return (
		<LegalDocumentLayout document={termsDocument}>
			<div className='space-y-10'>
				{termsSections.map((section) => (
					<section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`}>
						<h2 id={`${section.id}-title`} className='text-2xl font-semibold tracking-tight'>
							{section.title}
						</h2>
						<p className='mt-3 max-w-3xl leading-7 text-foreground/75'>{section.summary}</p>
					</section>
				))}
			</div>
		</LegalDocumentLayout>
	);
}
