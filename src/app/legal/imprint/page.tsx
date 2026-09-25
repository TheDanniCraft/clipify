import type { Metadata } from "next";
import { Link } from "@components/heroui-client";
import LegalDocumentLayout from "@components/legal/LegalDocumentLayout";
import { legalDocuments } from "@lib/legal/documents";

const imprintDocument = legalDocuments.find(({ id }) => id === "imprint")!;

export const metadata: Metadata = {
	title: "Imprint | Clipify",
	description: "Legal provider information for Clipify.",
	alternates: {
		canonical: "/legal/imprint",
	},
};

export default function ImprintPage() {
	return (
		<LegalDocumentLayout document={imprintDocument}>
			<div className='space-y-10'>
				<section className='border-b border-default pb-9'>
					<h2 className='mb-4 text-2xl font-semibold'>Provider information pursuant to Section 5 DDG</h2>
					<p>
						Daniel Trui
						<br />
						Frankenweg 12
						<br />
						75438 Knittlingen
						<br />
						Germany
					</p>
				</section>

				<section className='border-b border-default pb-9'>
					<h2 className='mb-4 text-2xl font-semibold'>Contact</h2>
					<p>
						Email:{" "}
						<Link className='underline-offset-4 hover:underline' href='mailto:contact@clipify.us'>
							contact@clipify.us
						</Link>
						<br />
						Phone:{" "}
						<Link className='underline-offset-4 hover:underline' href='tel:+4917666330972'>
							+49 176 66330972
						</Link>
					</p>
				</section>

				<section className='border-b border-default pb-9'>
					<h2 className='mb-4 text-2xl font-semibold'>VAT identification number</h2>
					<p>VAT identification number pursuant to Section 27a German VAT Act: DE420613306</p>
				</section>

				<section className='border-b border-default pb-9'>
					<h2 className='mb-4 text-2xl font-semibold'>Responsible for editorial content</h2>
					<p>Daniel Trui, address as stated above.</p>
				</section>

				<section className='border-b border-default pb-9'>
					<h2 className='mb-4 text-2xl font-semibold'>Consumer dispute resolution</h2>
					<p>We are not willing or obliged to participate in dispute-resolution proceedings before a consumer arbitration board.</p>
				</section>

				<section className='border-b border-default pb-9'>
					<h2 className='mb-4 text-2xl font-semibold'>Liability for content</h2>
					<p>As a service provider, we are responsible for our own content under general law. We are not generally obliged to monitor transmitted or stored third-party information or investigate circumstances indicating unlawful activity. Obligations to remove or block information under general law remain unaffected.</p>
				</section>

				<section className='border-b border-default pb-9'>
					<h2 className='mb-4 text-2xl font-semibold'>Liability for links</h2>
					<p>Clipify contains links to external websites whose content we do not control. The respective provider is responsible for that content. If we become aware of a specific legal infringement, we will remove the affected link where required.</p>
				</section>

				<section>
					<h2 className='mb-4 text-2xl font-semibold'>Copyright</h2>
					<p>Original content and works created for Clipify are protected by applicable copyright law. Reproduction, editing, distribution, or other use outside statutory limitations requires permission from the respective rights holder. Third-party content remains subject to the rights and licenses identified for it.</p>
				</section>
			</div>
		</LegalDocumentLayout>
	);
}
