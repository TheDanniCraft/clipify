"use client";

import { useEffect, useState } from "react";
import { usePlausible } from "next-plausible";

import type { CampaignOffer } from "@types";
import BasicNavbar from "@components/LandingPage/basicNavbar";
import { Accordion, Link, Card } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import Image from "next/image";

import { IconArrowRight, IconBrandTwitch, IconBrowser, IconCheck, IconPalette, IconChevronDown, IconDeviceRemote, IconUsersGroup, IconPlaylist } from "@tabler/icons-react";
import TiersComponent from "@components/Pricing";
import faqs from "@components/LandingPage/faqs";
import CommunityTeaser from "@components/LandingPage/communityTeaser";
import Footer from "@components/footer";
import FloatingBanner from "@components/floatingBanner";
import DemoPlayer from "@components/DemoPlayer";
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
	const plausible = usePlausible();
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
				<div className='relative isolate bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 text-white'>
					<BasicNavbar classNames={{ wrapper: "max-w-7xl" }} />
					<div className='mx-auto max-w-7xl px-6 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-20'>
						<div className='grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12'>
							<div>
								<p className='mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-violet-200'>
									<IconBrandTwitch size={16} aria-hidden='true' />
									Twitch clip player for OBS
								</p>
								<h1 className='max-w-xl text-[clamp(2.5rem,5vw,4.5rem)] font-bold leading-[1.06] tracking-tight'>
									Take a break.
									<br />
									<span className='text-violet-200'>
										Let your Twitch
										<br className='hidden xl:block' /> clips play.
									</span>
								</h1>
								<p className='mt-6 max-w-lg text-base leading-relaxed text-violet-100 sm:text-lg'>Turn your Twitch highlights into a BRB or Starting Soon screen. Choose your clips, save your overlay, and add it as a browser source in OBS.</p>
								<div className='mt-8 flex flex-wrap gap-3'>
									<Link href='/login' onPress={() => plausible("marketing_cta_click", { props: { placement: "hero", action: "start_free" } })} className={buttonVariants({ variant: "primary", size: "lg", className: "gap-2 bg-white text-violet-950 hover:bg-violet-100" })}>
										<IconBrandTwitch size={19} />
										Start free with Twitch
										<IconArrowRight size={18} />
									</Link>
									<Link href='#demo' className={buttonVariants({ variant: "outline", size: "lg", className: "border-white/40 text-white hover:bg-white/10" })}>
										Explore the demo
									</Link>
								</div>
								<p className='mt-4 text-xs leading-relaxed text-violet-200'>A permanent Free plan. Upgrade when you need more control.</p>
							</div>
							<DemoPlayer />
						</div>
						<div className='mt-12 flex flex-col items-start justify-between gap-5 border-t border-white/15 pt-6 sm:flex-row sm:items-center'>
							<div className='flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-violet-100'>
								<span className='flex items-center gap-2'>
									<IconBrowser size={16} aria-hidden='true' />
									Works as an OBS browser source
								</span>
								<span className='flex items-center gap-2'>
									<IconPlaylist size={16} aria-hidden='true' />
									Your clips, your selection
								</span>
								<span className='flex items-center gap-2'>
									<IconCheck size={16} aria-hidden='true' />
									Free to get started
								</span>
							</div>
							<Link href='/community' className='flex flex-wrap items-center gap-3 text-xs text-white'>
								{communityStreamers.length ? <CommunityTeaser streamers={communityStreamers} totalCount={communityPreview?.totalCount} countClassName='text-violet-100' /> : <IconUsersGroup size={18} aria-hidden='true' />}Explore the creator community
								<IconArrowRight size={15} />
							</Link>
						</div>
					</div>
				</div>

				<div className='bg-background'>
					<section aria-labelledby='setup-heading' className='mx-auto max-w-7xl px-6 py-16 sm:px-8 sm:py-24'>
						<div className='mb-10 grid gap-4 md:grid-cols-2 md:items-end'>
							<div>
								<p className='mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-accent dark:text-violet-300'>From highlights to your next break</p>
								<h2 id='setup-heading' className='text-3xl font-bold tracking-tight sm:text-4xl'>
									Your clips. One browser source.
								</h2>
							</div>
							<p className='max-w-md text-base leading-relaxed text-foreground/75 md:justify-self-end'>Set up your player in Clipify. Bring it into the scenes you already use in OBS, Streamlabs, or other software with browser sources.</p>
						</div>
						<ol className='grid gap-5 md:grid-cols-3'>
							{[
								{ title: "Connect Twitch", description: "Sign in with Twitch to set up your Clipify account and manage your clips.", icon: IconBrandTwitch },
								{ title: "Choose what plays", description: "Pick your clips, create a playlist, and save an overlay for your break scene.", icon: IconPlaylist },
								{ title: "Add it to OBS", description: "Copy your overlay URL into a browser source. Switch to your BRB scene and let your clips play.", icon: IconBrowser },
							].map((step, index) => (
								<li key={step.title}>
									<Card className='h-full border border-border shadow-none'>
										<Card.Content className='p-6'>
											<div className='mb-7 flex items-center justify-between'>
												<span className='flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
													<step.icon size={22} aria-hidden='true' />
												</span>
												<span className='text-sm font-medium tabular-nums text-foreground/75'>0{index + 1}</span>
											</div>
											<h3 className='mb-2 text-lg font-semibold'>{step.title}</h3>
											<p className='text-sm leading-relaxed text-foreground/75'>{step.description}</p>
										</Card.Content>
									</Card>
								</li>
							))}
						</ol>
					</section>

					<section id='features' aria-labelledby='features-heading' className='scroll-mt-20 border-y border-border bg-surface-secondary/50'>
						<div className='mx-auto max-w-7xl px-6 py-16 sm:px-8 sm:py-24'>
							<div className='mb-10 max-w-2xl'>
								<p className='mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-accent dark:text-violet-300'>More than a play button</p>
								<h2 id='features-heading' className='text-3xl font-bold tracking-tight sm:text-4xl'>
									A break screen that feels like your stream.
								</h2>
								<p className='mt-4 text-base leading-relaxed text-foreground/75'>Keep your clip selection, scene styling, and playback controls together. Save your setup so it is there for your next stream.</p>
							</div>
							<div className='grid gap-5 lg:grid-cols-3'>
								{[
									{ title: "Choose what plays", description: "Handpick a playlist or select clips with filters. Keep the highlights you want on screen.", icon: IconPlaylist, examples: ["Free: one playlist with up to 50 clips", "Pro: unlimited playlists and advanced filters", "Pro: Top and Smart Shuffle playback"] },
									{ title: "Make it fit your stream", description: "Use your overlay in a BRB or Starting Soon scene. With Pro, shape its look in Theme Studio.", icon: IconPalette, examples: ["Free: one saved overlay for your scenes", "Pro: custom layouts, colors, and fonts", "Pro: timers and progress styling"] },
									{ title: "Stay in control", description: "Pro puts playback controls within reach, and lets trusted teammates help manage your setup.", icon: IconDeviceRemote, examples: ["Pro: pause, skip, and mute remotely", "Pro: chat commands and channel points", "Pro: editor and manager access"] },
								].map((benefit) => (
									<Card key={benefit.title} className='border border-border shadow-none'>
										<Card.Content className='flex h-full flex-col p-6 sm:p-7'>
											<benefit.icon className='mb-6 text-accent' size={28} aria-hidden='true' />
											<h3 className='text-xl font-semibold'>{benefit.title}</h3>
											<p className='mb-7 mt-3 text-sm leading-relaxed text-foreground/75'>{benefit.description}</p>
											<ul className='mt-auto space-y-3 border-t border-border pt-5'>
												{benefit.examples.map((example) => (
													<li key={example} className='flex gap-2 text-sm leading-relaxed'>
														<IconCheck className='mt-0.5 shrink-0 text-accent' size={17} aria-hidden='true' />
														{example}
													</li>
												))}
											</ul>
										</Card.Content>
									</Card>
								))}
							</div>
							<div className='mt-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border px-6 py-5'>
								<p className='max-w-2xl text-sm leading-relaxed text-foreground/75'>
									<strong className='font-semibold text-foreground'>Clips beyond your break scene.</strong> Share a Creator Page, publish a gallery, or broadcast from your own computer with Runner. Runner is included with Free and Pro; your computer needs to stay online.
								</p>
								<Link href='/pricing' className='shrink-0 gap-2 text-sm font-medium'>
									Explore all features
									<IconArrowRight size={17} />
								</Link>
							</div>
						</div>
					</section>

					<section id='pricing' aria-labelledby='pricing-heading' className='mx-auto max-w-7xl scroll-mt-20 px-6 py-16 sm:px-8 sm:py-24'>
						<div className='mx-auto mb-10 max-w-2xl text-center'>
							<p className='mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-accent dark:text-violet-300'>Start free. Make it yours.</p>
							<h2 id='pricing-heading' className='text-3xl font-bold tracking-tight sm:text-4xl'>
								Your first break screen is on us.
							</h2>
							<p className='mt-4 text-base leading-relaxed text-foreground/75'>Free gives you one overlay and a playlist of up to 50 clips. Pro adds more room, custom styling, playback controls, and collaboration.</p>
							<p className='mt-3 text-sm leading-relaxed text-foreground/75'>Your clip library has no clip-count limit. The Free limit applies to the clips saved in a playlist.</p>
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
									A few things you might be wondering.
								</h2>
								<p className='mt-4 text-sm leading-relaxed text-foreground/75'>Need a hand with your setup? Our help center walks you through the details.</p>
								<Link href='https://help.clipify.us' className='mt-5 gap-2 text-sm font-medium'>
									Visit the help center
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
					<section aria-labelledby='start-heading' className='mx-4 mb-8 rounded-3xl bg-gradient-to-br from-brand-900 to-brand-700 px-6 py-14 text-center text-white sm:mx-8 sm:py-20'>
						<p className='mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-violet-200'>Your next break, covered</p>
						<h2 id='start-heading' className='text-3xl font-bold tracking-tight sm:text-4xl'>
							Step away. Keep the highlights rolling.
						</h2>
						<p className='mx-auto mb-7 mt-4 max-w-lg text-base leading-relaxed text-violet-100'>Build a break screen with the clips that make your channel yours.</p>
						<Link href='/login' onPress={() => plausible("marketing_cta_click", { props: { placement: "final", action: "start_free" } })} className={buttonVariants({ variant: "primary", size: "lg", className: "gap-2 bg-white text-violet-950 hover:bg-violet-100" })}>
							<IconBrandTwitch size={19} />
							Start free with Twitch
							<IconArrowRight size={18} />
						</Link>
						<p className='mt-4 text-xs text-violet-200'>Start on Free. Upgrade only when you choose.</p>
					</section>
				</div>
			</main>
			<Footer />
		</>
	);
}
