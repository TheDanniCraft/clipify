import type { Metadata } from "next";
import { Image, Link } from "@heroui/react";
import BasicNavbar from "@components/LandingPage/basicNavbar";

import Footer from "@components/footer";

export const metadata: Metadata = {
	title: "Imprint | Clipify",
	description: "Legal provider information for Clipify.",
	alternates: {
		canonical: "/imprint",
	},
};

export default function ImprintPage() {
	return (
		<>
			<div className='min-h-screen bg-background text-foreground'>
				<div className='border-b border-default-200 bg-background'>
					<BasicNavbar shouldHideOnScroll={false} />
					<div className='mx-auto grid max-w-4xl items-end gap-6 px-6 pb-10 pt-10 sm:grid-cols-[1fr_auto] sm:pt-12'>
						<div className='space-y-4'>
							<p className='text-sm font-semibold uppercase tracking-[0.2em] text-default-500'>Legal Information</p>
							<h1 className='text-4xl font-bold sm:text-5xl'>Imprint</h1>
							<p className='max-w-2xl text-base text-default-500 sm:text-lg'>Provider information in accordance with Section 5 German Telemedia Act (TMG).</p>
						</div>
						<Image src='/clippy/Clippy.svg' alt='Clippy mascot' className='h-24 w-24 sm:h-36 sm:w-36' />
					</div>
				</div>

				<div className='mx-auto max-w-4xl space-y-5 px-6 py-10 text-[15px] leading-7 sm:py-14 sm:text-base'>
					<section className='border-b border-default-200 pb-6'>
						<h2 className='mb-4 text-2xl font-semibold'>Provider</h2>
						<p>
							Daniel Trui
							<br />
							Einzelunternehmer
							<br />
							Frankenweg 12
							<br />
							75438 Knittlingen
							<br />
							Germany
						</p>
					</section>

					<section className='border-b border-default-200 pb-6'>
						<h2 className='mb-4 text-2xl font-semibold'>Contact</h2>
						<p>
							Email: <Link href='mailto:contact@clipify.us'>contact@clipify.us</Link>
							<br />
							Phone: <Link href='tel:+4917666330972'>+49 17666330972</Link>
						</p>
					</section>

					<section className='border-b border-default-200 pb-6'>
						<h2 className='mb-4 text-2xl font-semibold'>VAT Identification Number</h2>
						<p>DE-420613306</p>
					</section>

					<section className='border-b border-default-200 pb-6'>
						<h2 className='mb-4 text-2xl font-semibold'>Responsible for Content</h2>
						<p>Daniel Trui, address as above.</p>
					</section>

					<section className='border-b border-default-200 pb-6'>
						<h2 className='mb-4 text-2xl font-semibold'>EU Dispute Resolution</h2>
						<p>
							The European Commission provides a platform for online dispute resolution (ODR):{" "}
							<Link href='https://ec.europa.eu/consumers/odr' isExternal showAnchorIcon>
								https://ec.europa.eu/consumers/odr
							</Link>
							.
						</p>
					</section>

					<section className='border-b border-default-200 pb-6'>
						<h2 className='mb-4 text-2xl font-semibold'>Consumer Dispute Resolution / Universal Arbitration Board</h2>
						<p>We are not willing or obliged to participate in dispute resolution proceedings before a consumer arbitration board.</p>
					</section>

					<section className='border-b border-default-200 pb-6'>
						<h2 className='mb-4 text-2xl font-semibold'>Liability for Content</h2>
						<p>
							As a service provider, we are responsible for our own content on these pages under general laws. However, we are not obliged to monitor transmitted or stored third-party
							information or investigate circumstances indicating illegal activity. Obligations to remove or block the use of information under general laws remain unaffected.
						</p>
					</section>

					<section className='border-b border-default-200 pb-6'>
						<h2 className='mb-4 text-2xl font-semibold'>Liability for Links</h2>
						<p>
							Our site contains links to external websites of third parties, over whose content we have no control. Therefore, we cannot accept any liability for external content.
							The respective provider or operator of the linked pages is always responsible for their content.
						</p>
					</section>

					<section>
						<h2 className='mb-4 text-2xl font-semibold'>Copyright</h2>
						<p>
							Content and works created by the site operator on these pages are subject to copyright law. Reproduction, editing, distribution, and any type of use beyond the limits of
							copyright law require the written consent of the respective author or creator.
						</p>
					</section>
				</div>
			</div>

			<Footer />
		</>
	);
}
