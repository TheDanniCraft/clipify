import type { Metadata } from "next";
import LegalDocumentLayout from "@components/legal/LegalDocumentLayout";
import { legalDocuments } from "@lib/legal/documents";
import { privacyRequestGuidance } from "@lib/legal/rights";

const requestDocument = legalDocuments.find(({ id }) => id === "privacy-requests")!;

export const metadata: Metadata = {
	title: "Privacy Requests | Clipify",
	description: "How to make a privacy request to Clipify and what to expect next.",
};

function titleCase(value: string) {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function PrivacyRequestsPage() {
	return (
		<LegalDocumentLayout document={requestDocument}>
			<div className='space-y-10'>
				<section aria-labelledby='request-rights' className='border-b border-default pb-9'>
					<h2 id='request-rights' className='text-2xl font-semibold tracking-tight'>
						What you can request
					</h2>
					<p className='mt-3 max-w-3xl leading-7 text-foreground/75'>You do not need to know the legal name of a right or use a special form. Tell us what you want to understand or change.</p>
					<div className='mt-6 grid gap-4 sm:grid-cols-2'>
						{privacyRequestGuidance.requestTypes.map((requestType) => (
							<div key={requestType.title} className='rounded-2xl border border-default p-5'>
								<h3 className='font-semibold'>{requestType.title}</h3>
								<p className='mt-2 text-sm leading-6 text-foreground/70'>{requestType.description}</p>
							</div>
						))}
					</div>
				</section>

				<section aria-labelledby='start-request' className='border-b border-default pb-9'>
					<h2 id='start-request' className='text-2xl font-semibold tracking-tight'>
						How to start
					</h2>
					<p className='mt-3 max-w-3xl leading-7 text-foreground/75'>
						Email{" "}
						<a className='font-medium text-primary underline-offset-4 hover:underline' href={`mailto:${privacyRequestGuidance.contact.email}`}>
							{privacyRequestGuidance.contact.email}
						</a>
						. No Clipify account is required, and a request sent through another clear contact channel will not be rejected solely because you did not use this page.
					</p>
					<p className='mt-3 max-w-3xl leading-7 text-foreground/75'>{privacyRequestGuidance.processStageDetails.submission}</p>
				</section>

				<section aria-labelledby='request-verification' className='border-b border-default pb-9'>
					<h2 id='request-verification' className='text-2xl font-semibold tracking-tight'>
						How identity verification works
					</h2>
					<p className='mt-3 max-w-3xl leading-7 text-foreground/75'>{privacyRequestGuidance.verification}</p>
					<p className='mt-3 max-w-3xl leading-7 text-foreground/75'>{privacyRequestGuidance.processStageDetails["identity verification"]}</p>
					<p className='mt-3 max-w-3xl leading-7 text-foreground/75'>Do not include {privacyRequestGuidance.initialRequestDoNotInclude.join(", ")} in your first message.</p>
				</section>

				<section aria-labelledby='request-process' className='border-b border-default pb-9'>
					<h2 id='request-process' className='text-2xl font-semibold tracking-tight'>
						What happens next
					</h2>
					<ol className='mt-5 space-y-5'>
						{privacyRequestGuidance.processStages.map((stage, index) => (
							<li key={stage} className='grid grid-cols-[2rem_1fr] gap-3'>
								<span className='flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary'>{index + 1}</span>
								<div>
									<h3 className='font-semibold'>{titleCase(stage)}</h3>
									<p className='mt-1 max-w-3xl text-foreground/75'>{privacyRequestGuidance.processStageDetails[stage]}</p>
								</div>
							</li>
						))}
					</ol>
				</section>

				<section aria-labelledby='request-timing' className='border-b border-default pb-9'>
					<h2 id='request-timing' className='text-2xl font-semibold tracking-tight'>
						Timing and cost
					</h2>
					<p className='mt-3 max-w-3xl leading-7 text-foreground/75'>{privacyRequestGuidance.timing}</p>
					<p className='mt-3 max-w-3xl leading-7 text-foreground/75'>{privacyRequestGuidance.costs}</p>
				</section>

				<section aria-labelledby='request-qualifications' className='border-b border-default pb-9'>
					<h2 id='request-qualifications' className='text-2xl font-semibold tracking-tight'>
						When a request can be limited
					</h2>
					<ul className='mt-3 max-w-3xl list-disc space-y-2 pl-6 text-foreground/75'>
						{privacyRequestGuidance.qualifications.map((qualification) => (
							<li key={qualification}>{qualification}</li>
						))}
					</ul>
				</section>

				<section aria-labelledby='complaint-routes'>
					<h2 id='complaint-routes' className='text-2xl font-semibold tracking-tight'>
						Questions and complaints
					</h2>
					<ul className='mt-3 max-w-3xl list-disc space-y-2 pl-6 text-foreground/75'>
						{privacyRequestGuidance.complaintRoutes.map((route) => (
							<li key={route}>{route}</li>
						))}
					</ul>
				</section>
			</div>
		</LegalDocumentLayout>
	);
}
