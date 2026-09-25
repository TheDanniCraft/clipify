import type { Metadata } from "next";
import LegalDocumentLayout from "@components/legal/LegalDocumentLayout";
import CookiePreferencesLink from "@components/legal/CookiePreferencesLink";
import { getAlwaysOnServiceDisclosures, projectConsentCategories } from "@lib/legal/consentProjection";
import { legalDocuments } from "@lib/legal/documents";

const cookieDocument = legalDocuments.find(({ id }) => id === "cookies")!;
const categories = projectConsentCategories({ necessary: true, functionality: false, measurement: false });

export const metadata: Metadata = {
	title: "Cookie Policy | Clipify",
	description: "Clipify's authoritative service and browser-storage declarations.",
};

export default function CookiesPage() {
	return (
		<LegalDocumentLayout document={cookieDocument}>
			<section aria-labelledby='service-declarations-title'>
				<h2 id='service-declarations-title' className='text-2xl font-semibold tracking-tight'>
					Service and storage declarations
				</h2>
				<p className='mt-3 max-w-3xl leading-7 text-foreground/75'>This complete declared inventory is the authoritative description of services and browser storage used by Clipify.</p>
				<div className='mt-5 inline-flex rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-primary underline-offset-4 hover:underline'>
					<CookiePreferencesLink />
				</div>
				<div className='mt-8 space-y-10'>
					{categories.map((category) => (
						<section key={category.id} aria-labelledby={`category-${category.id}`}>
							<h3 id={`category-${category.id}`} className='text-xl font-semibold'>
								{category.title}
							</h3>
							<p className='mt-2 text-foreground/70'>{category.description}</p>
							<div className='mt-4 grid gap-4'>
								{category.services.map((service) => (
									<article key={service.id} aria-labelledby={`service-${service.id}`} className='rounded-2xl border border-white/10 p-5'>
										<h4 id={`service-${service.id}`} className='font-semibold'>
											{service.name}
										</h4>
										<p className='mt-2 text-sm leading-6 text-foreground/75'>{service.purpose}</p>
										<dl className='mt-4 grid gap-2 text-sm sm:grid-cols-2'>
											<div>
												<dt className='font-medium'>Provider or recipient</dt>
												<dd>{service.recipient}</dd>
											</div>
											<div>
												<dt className='font-medium'>Data categories</dt>
												<dd>{service.dataCategories.join(", ")}</dd>
											</div>
											<div>
												<dt className='font-medium'>Storage</dt>
												<dd>{service.storage}</dd>
											</div>
											<div>
												<dt className='font-medium'>Retention</dt>
												<dd>{service.retention}</dd>
											</div>
											<div>
												<dt className='font-medium'>Consent status</dt>
												<dd>{service.consentRequired ? "Consent required" : "Always active"}</dd>
											</div>
											<div>
												<dt className='font-medium'>Hosting and transfers</dt>
												<dd>{service.hostingRegions.join(", ")}</dd>
											</div>
										</dl>
									</article>
								))}
							</div>
						</section>
					))}
					<section aria-labelledby='always-on-services'>
						<h3 id='always-on-services' className='text-xl font-semibold'>
							Cookieless audience statistics
						</h3>
						{getAlwaysOnServiceDisclosures().map((service) => (
							<p key={service.id} className='mt-2 text-foreground/70'>
								<strong>{service.name}:</strong> {service.purpose}
							</p>
						))}
					</section>
				</div>
			</section>
		</LegalDocumentLayout>
	);
}
