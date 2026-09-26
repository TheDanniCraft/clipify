import type { Metadata } from "next";
import LegalDocumentLayout from "@components/legal/LegalDocumentLayout";
import LegalSections from "@components/legal/LegalSections";
import { legalDocuments, privacyPolicySections } from "@lib/legal/documents";

const privacyDocument = legalDocuments.find(({ id }) => id === "privacy")!;

export const metadata: Metadata = {
	title: "Privacy Policy | Clipify",
	description: "How Clipify processes and protects personal data.",
};

export default function PrivacyPage() {
	return (
		<LegalDocumentLayout document={privacyDocument}>
			<LegalSections sections={privacyPolicySections} />
		</LegalDocumentLayout>
	);
}
