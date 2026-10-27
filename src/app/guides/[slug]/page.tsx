import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
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
				<Link href='/features' className='mb-8 text-sm'>
					Explore Clipify
				</Link>
				<article>
					<h1 className='max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl'>{guide.title}</h1>
					<p className='mt-6 max-w-3xl text-lg leading-relaxed text-foreground/75'>{guide.intro}</p>
					<Image src={guide.image} alt={guide.imageAlt} width={1920} height={1080} sizes='(max-width: 1024px) 100vw, 960px' className='my-10 h-auto w-full rounded-2xl border border-border bg-zinc-950' />
					<div className='max-w-3xl space-y-10'>
						<section>
							<h2 className='text-2xl font-semibold'>What you need</h2>
							<p className='mt-3 leading-relaxed text-foreground/75'>{guide.requirements}</p>
						</section>
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
							<Link href='https://help.clipify.us/' className='mt-4'>
								Open the help center
							</Link>
						</section>
					</div>
				</article>
				<section className='mt-14 rounded-3xl bg-gradient-to-br from-brand-900 to-brand-600 p-8 text-white'>
					<h2 className='text-2xl font-bold'>Put your highlights back on stream.</h2>
					<Link href='/login' className='mt-5 rounded-full bg-white px-5 py-3 font-semibold text-violet-950'>
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
