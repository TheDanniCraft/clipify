import { buttonVariants } from "@heroui/styles";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductImage from "@components/LandingPage/productImage";
import { Link } from "@components/heroui-client";
import BasicNavbar from "@components/LandingPage/basicNavbar";
import Footer from "@components/footer";
import { publicGuides } from "@lib/publicGuides";

type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() {
	return publicGuides.map(({ slug }) => ({ slug }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug } = await params;
	const guide = publicGuides.find((item) => item.slug === slug);
	if (!guide) return {};
	const url = `https://clipify.us/guides/${guide.slug}`;
	return { title: `${guide.title} | Clipify`, description: guide.description, alternates: { canonical: url }, openGraph: { title: guide.title, description: guide.description, url, type: "article" }, twitter: { card: "summary_large_image", title: guide.title, description: guide.description } };
}
export default async function GuidePage({ params }: Props) {
	const { slug } = await params;
	const guide = publicGuides.find((item) => item.slug === slug);
	if (!guide) notFound();
	return (
		<>
			<BasicNavbar />
			<main className='mx-auto max-w-5xl px-6 py-12 sm:px-8 sm:py-20'>
				<article>
					<h1 className='max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl'>{guide.title}</h1>
					<p className='mt-6 max-w-3xl text-lg leading-relaxed text-foreground/75'>{guide.intro}</p>

					<div className='max-w-3xl space-y-10'>
						<section>
							<h2 className='text-2xl font-semibold'>What you need</h2>
							<p className='mt-3 leading-relaxed text-foreground/75'>{guide.requirements}</p>
						</section>
						{guide.productView ? (
							<ProductImage view={guide.productView} className='my-10' />
						) : guide.reference ? (
							<section className='border-y border-separator py-7'>
								<h2 className='text-2xl font-semibold'>{guide.reference.title}</h2>
								<p className='mt-3 leading-relaxed text-foreground/75'>{guide.reference.intro}</p>
								<dl className='mt-5 divide-y divide-separator'>
									{guide.reference.rows.map(({ label, detail }) => (
										<div key={label} className='grid grid-cols-[6rem_1fr] gap-4 py-3'>
											<dt className='font-mono font-semibold'>{label}</dt>
											<dd className='text-foreground/75'>{detail}</dd>
										</div>
									))}
								</dl>
							</section>
						) : null}
						<ol className='space-y-9'>
							{guide.steps.map((step, index) => (
								<li key={step.title}>
									<h2 className='text-2xl font-semibold'>
										<span className='mr-3 text-accent dark:text-violet-300'>{index + 1}.</span>
										{step.title}
									</h2>
									<p className='mt-3 leading-relaxed text-foreground/75'>{step.text}</p>
								</li>
							))}
						</ol>
						<section>
							<h2 className='text-2xl font-semibold'>Plans and limits</h2>
							<p className='mt-3 leading-relaxed text-foreground/75'>{guide.limits}</p>
							<Link href='/pricing' className='mt-4'>
								Compare Free and Pro
							</Link>
						</section>
						<section>
							<h2 className='text-2xl font-semibold'>If something does not work</h2>
							<p className='mt-3 leading-relaxed text-foreground/75'>{guide.troubleshooting}</p>
							<Link href={guide.helpHref} className='mt-4'>
								Read the full Help Center guide
							</Link>
						</section>
					</div>
				</article>
				<section className='mt-14 border-t border-separator pt-10'>
					<h2 className='text-2xl font-bold'>Set up your clip player.</h2>
					<Link href='/login' className={buttonVariants({ variant: "primary", className: "mt-5 no-underline" })}>
						Start free with Twitch
					</Link>
				</section>
				<nav aria-label='More Clipify guides' className='mt-12 grid gap-4 sm:grid-cols-2'>
					{publicGuides
						.filter((item) => item.slug !== slug)
						.map((item) => (
							<Link key={item.slug} href={`/guides/${item.slug}`} className='rounded-xl border border-border p-5'>
								{item.title} →
							</Link>
						))}
				</nav>
			</main>
			<Footer />
		</>
	);
}
