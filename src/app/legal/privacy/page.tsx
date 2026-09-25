import type { Metadata } from "next";
import LegalDocumentLayout from "@components/legal/LegalDocumentLayout";
import { legalDocuments, privacyPolicySections } from "@lib/legal/documents";

const privacyDocument = legalDocuments.find(({ id }) => id === "privacy")!;

export const metadata: Metadata = {
	title: "Privacy Policy | Clipify",
	description: "How Clipify processes and protects personal data.",
};

export default function PrivacyPage() {
	return (
		<LegalDocumentLayout document={privacyDocument}>
			<div className='space-y-10'>
				{privacyPolicySections.map((section) => (
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
