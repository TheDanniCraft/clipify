import type { Metadata } from "next";
import LegalDocumentLayout from "@components/legal/LegalDocumentLayout";
import { legalDocuments } from "@lib/legal/documents";
import { privacyRequestGuidance } from "@lib/legal/rights";

const requestDocument = legalDocuments.find(({ id }) => id === "privacy-requests")!;

export const metadata: Metadata = {
	title: "Privacy Requests | Clipify",
	description: "How to make a privacy request to Clipify and what to expect next.",
};

export default function PrivacyRequestsPage() {
	return (
		<LegalDocumentLayout document={requestDocument}>
			<div className='space-y-10'>
				<section aria-labelledby='start-request'>
					<h2 id='start-request' className='text-2xl font-semibold tracking-tight'>
						Start a request
					</h2>
					<p className='mt-3 max-w-3xl leading-7 text-foreground/75'>
						Email{" "}
						<a className='underline underline-offset-4' href={`mailto:${privacyRequestGuidance.contact.email}`}>
							{privacyRequestGuidance.contact.email}
						</a>
						. No Clipify account is required to use this request channel.
					</p>
					<p className='mt-3 text-foreground/75'>You can ask about {privacyRequestGuidance.intentions.join(", ")}.</p>
				</section>
				<section aria-labelledby='request-safety'>
					<h2 id='request-safety' className='text-2xl font-semibold tracking-tight'>
						Keep the first message safe
					</h2>
					<p className='mt-3 text-foreground/75'>Do not include {privacyRequestGuidance.initialRequestDoNotInclude.join(", ")} in your initial request.</p>
					<p className='mt-3 text-foreground/75'>{privacyRequestGuidance.verification}</p>
				</section>
				<section aria-labelledby='request-process'>
					<h2 id='request-process' className='text-2xl font-semibold tracking-tight'>
						What happens next
					</h2>
					<ol className='mt-3 list-decimal space-y-2 pl-6 text-foreground/75'>
						{privacyRequestGuidance.processStages.map((stage) => (
							<li key={stage}>{stage}</li>
						))}
					</ol>
				</section>
				<section aria-labelledby='request-qualifications'>
					<h2 id='request-qualifications' className='text-2xl font-semibold tracking-tight'>
						Applicability and lawful limits
					</h2>
					<ul className='mt-3 list-disc space-y-2 pl-6 text-foreground/75'>
						{privacyRequestGuidance.qualifications.map((qualification) => (
							<li key={qualification}>{qualification}</li>
						))}
					</ul>
				</section>
				<section aria-labelledby='complaint-routes'>
					<h2 id='complaint-routes' className='text-2xl font-semibold tracking-tight'>
						Questions and complaints
					</h2>
					<ul className='mt-3 list-disc space-y-2 pl-6 text-foreground/75'>
						{privacyRequestGuidance.complaintRoutes.map((route) => (
							<li key={route}>{route}</li>
						))}
					</ul>
				</section>
			</div>
		</LegalDocumentLayout>
	);
}
