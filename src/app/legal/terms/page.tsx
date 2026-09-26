import type { Metadata } from "next";
import LegalDocumentLayout from "@components/legal/LegalDocumentLayout";
import LegalSections from "@components/legal/LegalSections";
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
			<LegalSections sections={termsSections} />
		</LegalDocumentLayout>
	);
}
