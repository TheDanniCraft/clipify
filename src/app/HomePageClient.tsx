"use client";

import { useEffect, useState } from "react";
import { trackEvent } from "@lib/analytics";

import type { CampaignOffer } from "@types";
import BasicNavbar from "@components/LandingPage/basicNavbar";
import { Accordion, Link, Card } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import Image from "next/image";

import { IconArrowRight, IconBrandTwitch, IconChevronDown, IconUsersGroup } from "@tabler/icons-react";
import TiersComponent from "@components/Pricing";
import faqs from "@components/LandingPage/faqs";
import CommunityTeaser from "@components/LandingPage/communityTeaser";
import Footer from "@components/footer";
import FloatingBanner from "@components/floatingBanner";
import DemoPlayer from "@components/DemoPlayer";
import ProductImage from "@components/LandingPage/productImage";
import CountdownTimer from "@components/countdownTimer";
import { getPublicCommunityTeaserAction } from "@actions/community";
import type { CommunityTeaserPayload } from "@lib/community-types";
import type { RuntimePricing } from "@components/Pricing/pricing-types";

export function buildCampaignOfferHref(ctaHref: string, utmCampaign?: string | null): string {
	if (!utmCampaign) return ctaHref;

	try {
		const url = new URL(ctaHref, "https://clipify.local");
		if (url.pathname !== "/redeem" || url.searchParams.has("campaign")) return ctaHref;
		url.searchParams.set("campaign", utmCampaign);
		const isAbsolute = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(ctaHref);
		return isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
	} catch {
		return ctaHref;
	}
}

type HomePageClientProps = {
	campaignOffer: CampaignOffer | null;
	pricing: RuntimePricing;
};

export default function HomePageClient({ campaignOffer, pricing }: HomePageClientProps) {
	const campaignOfferHref = campaignOffer ? buildCampaignOfferHref(campaignOffer.ctaHref, campaignOffer.utmCampaign) : null;
	const floatingCtaLabel = campaignOffer?.floatingCtaLabel ?? campaignOffer?.ctaLabel;
	const floatingTitle = campaignOffer?.floatingTitle ?? campaignOffer?.badgeText ?? campaignOffer?.title;
	const floatingSubtitle = campaignOffer?.floatingSubtitle ?? campaignOffer?.subtitle ?? campaignOffer?.title;
	const [communityPreview, setCommunityPreview] = useState<CommunityTeaserPayload | null>(null);
	const communityStreamers = communityPreview?.streamers ?? [];

	useEffect(() => {
		let cancelled = false;

		getPublicCommunityTeaserAction()
			.then((payload: CommunityTeaserPayload) => {
				if (!cancelled && payload) {
					setCommunityPreview(payload);
				}
			})
			.catch((error: unknown) => {
				console.error("Error fetching homepage community preview:", error);
			});

		return () => {
			cancelled = true;
		};
	}, []);

	const floatingBannerCta = campaignOffer ? (
		<Link href={campaignOfferHref ?? campaignOffer.ctaHref} className={buttonVariants({ variant: "primary", size: "sm", className: "bg-accent-foreground text-accent hover:bg-accent-foreground/90" })}>
			{floatingCtaLabel}
		</Link>
	) : undefined;

	return (
		<>
			{campaignOffer && campaignOffer.showFloatingBanner ? <FloatingBanner icon={campaignOffer.iconUrl ? <Image unoptimized alt={`${campaignOffer.title} Icon`} src={campaignOffer.iconUrl} width={50} height={50} className='h-[50px] w-[50px] shrink-0 rounded-none object-contain' /> : undefined} title={floatingTitle ?? campaignOffer.title} text={floatingSubtitle ?? campaignOffer.title} cta={floatingBannerCta} /> : null}
			<main id='home'>
				<div className='bg-background text-foreground'>
					<BasicNavbar classNames={{ wrapper: "max-w-7xl" }} />
					<section className='mx-auto max-w-7xl px-6 pb-12 pt-12 sm:px-8 sm:pt-20' aria-labelledby='hero-heading'>
						<div className='mx-auto max-w-3xl text-center'>
							<p className='mb-5 text-sm font-medium text-accent dark:text-violet-300'>Twitch clips for OBS and Streamlabs</p>
							<h1 id='hero-heading' className='text-[clamp(2.5rem,6vw,5rem)] font-semibold leading-[1.04] tracking-tight'>
								Your best moments.
								<br />
								<span className='text-accent dark:text-violet-300'>Back on stream.</span>
							</h1>
							<p className='mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted'>Turn your Twitch clips into a break screen. Pick what plays, make it yours, and add one browser source to OBS.</p>
							<div className='mt-7 flex flex-wrap justify-center gap-3'>
								<Link href='/login' onPress={() => trackEvent("marketing_cta_click", { placement: "hero", action: "start_free" })} className={buttonVariants({ variant: "primary", size: "lg", className: "gap-2" })}>
									Start free with Twitch
									<IconArrowRight size={18} aria-hidden='true' />
								</Link>
								<Link href='#demo' className={buttonVariants({ variant: "secondary", size: "lg" })}>
									Explore the demo
								</Link>
							</div>
							<p className='mt-4 text-sm text-muted'>Free to start. No card required. No Runner installation needed.</p>
						</div>
						<div className='mx-auto mt-12 max-w-5xl'>
							<DemoPlayer />
						</div>
						<div className='mx-auto mt-6 flex max-w-5xl flex-wrap items-center justify-between gap-4 text-sm text-muted'>
							<p>BRB, Starting Soon, or a scene of your own.</p>
							<Link href='/community' className='flex flex-wrap items-center gap-3 text-sm text-foreground'>
								{communityStreamers.length ? <CommunityTeaser streamers={communityStreamers} totalCount={communityPreview?.totalCount} countClassName='text-muted' /> : <IconUsersGroup size={18} aria-hidden='true' />}
								Explore the creator community
								<IconArrowRight size={15} aria-hidden='true' />
							</Link>
						</div>
					</section>
				</div>

				<div className='bg-background'>
					<section aria-labelledby='setup-heading' className='mx-auto max-w-7xl border-t border-border px-6 py-14 sm:px-8 sm:py-20'>
						<div className='grid gap-8 lg:grid-cols-[1fr_2fr] lg:gap-16'>
							<h2 id='setup-heading' className='max-w-xs text-3xl font-semibold tracking-tight'>
								From Twitch to your next break.
							</h2>
							<ol className='grid gap-8 sm:grid-cols-3'>
								{[
									{ title: "Connect Twitch", text: "Sign in to find your clips and start your setup." },
									{ title: "Choose what plays", text: "Save a playlist or choose a clip source for your overlay." },
									{ title: "Add it to OBS", text: "Paste your private overlay URL into a browser source. Preview it, then switch scenes." },
								].map((step, i) => (
									<li key={step.title}>
										<p className='mb-4 text-sm tabular-nums text-accent dark:text-violet-300'>0{i + 1}</p>
										<h3 className='font-semibold'>{step.title}</h3>
										<p className='mt-2 text-sm leading-relaxed text-muted'>{step.text}</p>
									</li>
								))}
							</ol>
						</div>
					</section>

					<section id='features' aria-labelledby='features-heading' className='scroll-mt-20 border-y border-border bg-surface-secondary/40'>
						<div className='mx-auto max-w-7xl px-6 py-16 sm:px-8 sm:py-24'>
							<div className='grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16'>
								<div>
									<p className='mb-4 text-sm text-accent dark:text-violet-300'>Your clips, your selection</p>
									<h2 id='features-heading' className='text-3xl font-semibold tracking-tight sm:text-4xl'>
										A playlist worth
										<br className='hidden sm:block' /> coming back to.
									</h2>
									<p className='mt-5 text-lg leading-relaxed text-muted'>Keep the clutch, the running joke, and the moments chat remembers. Add and arrange your Twitch highlights in a saved playlist.</p>
									<p className='mt-4 leading-relaxed text-muted'>Update the clips in Clipify. Your OBS browser source stays the same.</p>
									<Link href='/features#playlists' className='mt-6 gap-2 font-medium'>
										Build your playlist
										<IconArrowRight size={18} aria-hidden='true' />
									</Link>
								</div>
								<ProductImage view='playlist' />
							</div>
						</div>
					</section>

					<section aria-labelledby='pro-features-heading' className='mx-auto max-w-7xl px-6 py-16 sm:px-8 sm:py-24'>
						<div className='mb-12 flex flex-wrap items-end justify-between gap-6'>
							<div>
								<p className='mb-3 text-sm text-accent dark:text-violet-300'>Go further with Pro</p>
								<h2 id='pro-features-heading' className='max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl'>
									Your scene. Your style.
									<br />
									Your team at the controls.
								</h2>
							</div>
							<Link href='#pricing' className={buttonVariants({ variant: "secondary" })}>
								Compare Free and Pro
							</Link>
						</div>
						<div className='grid gap-12 md:grid-cols-2'>
							<article className='min-w-0'>
								<div className='mb-6 bg-surface-secondary rounded-xl p-3 sm:p-6'>
									<ProductImage view='theme' />
								</div>
								<h3 className='text-xl font-semibold'>Make the break screen yours</h3>
								<p className='mt-3 max-w-lg leading-relaxed text-muted'>Arrange clip information, timers, fonts, and colors in Theme Studio. Save different overlays for the scenes you use.</p>
								<Link href='/features#styling' className='mt-4 gap-2'>
									Explore scene styling
									<IconArrowRight size={16} aria-hidden='true' />
								</Link>
							</article>
							<article className='min-w-0'>
								<div className='mb-6 bg-surface-secondary rounded-xl p-3 sm:p-6'>
									<ProductImage view='controls' />
								</div>
								<h3 className='text-xl font-semibold'>Give your moderators the controls</h3>
								<p className='mt-3 max-w-lg leading-relaxed text-muted'>Skip, pause, or mute from a second screen. Let trusted teammates help with their own accounts, chat commands, and channel points.</p>
								<Link href='/features#controls' className='mt-4 gap-2'>
									See playback controls
									<IconArrowRight size={16} aria-hidden='true' />
								</Link>
							</article>
						</div>
						<div className='mt-14 grid gap-6 border-t border-border pt-8 sm:grid-cols-2'>
							<div>
								<h3 className='font-semibold'>Share clips beyond your stream</h3>
								<p className='mt-2 text-muted'>Publish a gallery or Creator Page for your viewers.</p>
								<Link href='/gallery' className='mt-3'>
									Try the gallery
								</Link>
							</div>
							<div>
								<h3 className='font-semibold'>Broadcast from your own computer</h3>
								<p className='mt-2 text-muted'>Optional Runner adds standalone broadcasting. Pro includes scheduling and multiple destinations.</p>
								<Link href='/features#runner' className='mt-3'>
									Explore Runner
								</Link>
							</div>
						</div>
					</section>

					<section id='pricing' aria-labelledby='pricing-heading' className='mx-auto max-w-7xl scroll-mt-20 px-6 py-16 sm:px-8 sm:py-24'>
						<div className='mx-auto mb-10 max-w-2xl text-center'>
							<h2 id='pricing-heading' className='text-3xl font-bold tracking-tight sm:text-4xl'>
								Free for your first scene. Pro when you need more.
							</h2>
							<p className='mt-4 text-base leading-relaxed text-foreground/75'>Get your first clip playlist on stream for free. No card required.</p>
						</div>
						{campaignOffer && campaignOffer.showPricingCard ? (
							<div className='mx-auto w-full max-w-md mt-12'>
								<div className='relative'>
									<div className='absolute -inset-1 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 blur-2xl opacity-60'></div>

									<Card className='relative bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl shadow-lg'>
										<Card.Header className='p-4 pb-2'>
											<div className='flex items-center gap-2 rounded-none'>
												{campaignOffer.iconUrl ? <Image unoptimized alt={`${campaignOffer.title} Icon`} className='rounded-none' src={campaignOffer.iconUrl} width={28} height={28} /> : null}
												<h2 className='text-[17px] md:text-[18px] font-semibold leading-[1.1] tracking-tight'>{campaignOffer.title}</h2>
											</div>
										</Card.Header>

										<Card.Content className='px-4 pb-4 space-y-3'>
											<p className='text-base'>
												{campaignOffer.offerCode ? (
													<>
														Use <span className='font-bold bg-white text-purple-700 px-2 py-0.5 rounded'>{campaignOffer.offerCode}</span>
														{campaignOffer.subtitle ? ` ${campaignOffer.subtitle}` : ""}
													</>
												) : (
													(campaignOffer.subtitle ?? campaignOffer.badgeText ?? campaignOffer.title)
												)}
											</p>
											{campaignOffer?.endAt ? (
												<div className='flex justify-center'>
													<CountdownTimer endAt={campaignOffer.endAt} tone='light' showSeconds className='pt-1' />
												</div>
											) : null}

											<Link href={campaignOfferHref ?? campaignOffer.ctaHref} className={buttonVariants({ variant: "primary", fullWidth: true, className: "bg-accent-foreground text-accent hover:bg-accent-foreground/90" })}>
												{campaignOffer.ctaLabel}
											</Link>
										</Card.Content>
									</Card>
								</div>
							</div>
						) : null}
						<TiersComponent source='homepage' campaignOffer={campaignOffer} pricing={pricing} showRunner={false} />
					</section>

					<section id='faq' aria-labelledby='faq-heading' className='scroll-mt-20 border-t border-border'>
						<div className='mx-auto grid max-w-7xl gap-8 px-6 py-16 sm:px-8 sm:py-24 lg:grid-cols-[0.7fr_1fr] lg:gap-20'>
							<div>
								<p className='mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-accent dark:text-violet-300'>Before your next stream</p>
								<h2 id='faq-heading' className='text-3xl font-bold tracking-tight sm:text-4xl'>
									Questions before your next stream.
								</h2>
								<p className='mt-4 text-sm leading-relaxed text-foreground/75'>Find setup instructions, troubleshooting, and the details in the Help Center.</p>
								<Link href='https://help.clipify.us/hc/clipify/articles/1769328012-getting-started-with-clipify' className='mt-5 gap-2 text-sm font-medium'>
									Read the setup guide
									<IconArrowRight size={17} />
								</Link>
							</div>
							<Accordion allowsMultipleExpanded variant='default'>
								{faqs.map((item, i) => (
									<Accordion.Item key={item.title} id={String(i)}>
										<Accordion.Heading>
											<Accordion.Trigger className='py-5 text-base'>
												<span>{item.title}</span>
												<Accordion.Indicator>
													<IconChevronDown size={20} />
												</Accordion.Indicator>
											</Accordion.Trigger>
										</Accordion.Heading>
										<Accordion.Panel>
											<Accordion.Body className='pb-6 text-sm leading-relaxed text-foreground/75'>{item.content}</Accordion.Body>
										</Accordion.Panel>
									</Accordion.Item>
								))}
							</Accordion>
						</div>
					</section>
					<section aria-labelledby='start-heading' className='mx-auto max-w-7xl border-t border-border px-6 py-16 text-center sm:px-8 sm:py-24'>
						<h2 id='start-heading' className='text-3xl font-bold tracking-tight sm:text-4xl'>
							Give your next break a better scene.
						</h2>
						<p className='mx-auto mb-7 mt-4 max-w-lg text-base leading-relaxed text-muted'>Build a break screen with the clips that make your channel yours.</p>
						<Link href='/login' onPress={() => trackEvent("marketing_cta_click", { placement: "final", action: "start_free" })} className={buttonVariants({ variant: "primary", size: "lg", className: "gap-2" })}>
							<IconBrandTwitch size={19} />
							Start free with Twitch
							<IconArrowRight size={18} />
						</Link>
					</section>
				</div>
			</main>
			<Footer />
		</>
	);
}
