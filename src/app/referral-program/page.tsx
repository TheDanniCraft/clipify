"use client";
import { Accordion, Button, Chip } from "@heroui/react";

import { IconArrowRight, IconChartBar, IconChevronDown, IconClock, IconCoin, IconLink, IconRepeat, IconReportMoney, IconUsers } from "@tabler/icons-react";
import FeatureCard from "../components/featureCard";
import Link from "next/link";
import Footer from "@components/footer";
import faqs from "@components/AffiliatePage/faqs";
import BasicNavbar from "@components/LandingPage/basicNavbar";

export default function AffiliateProgram() {
	return (
		<>
			<div className='bg-gradient-to-br from-brand-800 to-brand-400 min-h-dvh relative flex flex-col overflow-hidden'>
				<BasicNavbar />

				<div
					className='
                    pointer-events-none
                    absolute inset-[-20%]
                    bg-hero-vignette
                    mix-blend-multiply
                    blur-3xl
                    opacity-30
                    '
				/>

				<main className='container mx-auto flex flex-1 flex-col justify-center overflow-hidden px-8'>
					<section className='z-20 grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]'>
						<div className='flex flex-col items-start gap-6'>
							<Button variant='secondary'>
								Clipify Public Affiliate Program
							{<IconArrowRight className='flex-none outline-hidden [&>path]:stroke-2' width={20} />}</Button>

							<div className='text-left text-[clamp(40px,10vw,44px)] leading-[1.1] font-bold tracking-tighter sm:text-[64px] text-white'>
								<div className='bg-hero-section-title bg-clip-text text-transparent'>
									Turn your audience
									<br />
									into recurring revenue.
								</div>
							</div>

							<p className='text-white/70 leading-7 font-normal sm:text-[18px] max-w-xl'>Share Clipify with other creators and earn on every paid signup. Clean attribution, clear rules, and payouts you can trust.</p>

							<div className='flex flex-wrap items-center gap-3 text-xs text-white/90'>
								<span className='px-3 py-1 rounded-full border border-white/20 bg-white/10'>30-day cookie</span>
								<span className='px-3 py-1 rounded-full border border-white/20 bg-white/10'>Recurring commissions</span>
								<span className='px-3 py-1 rounded-full border border-white/20 bg-white/10'>Real-time dashboard</span>
							</div>

							<div className='flex flex-col items-start gap-4 sm:flex-row sm:items-center'>
								<Link className='bg-white text-sm text-slate-900 h-10 px-[18px] py-[10px] leading-5 font-semibold rounded-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-medium bg-accent text-accent-foreground hover:bg-accent-hover' href='https://affiliate.clipify.us/register'>
									Join Now
								</Link>
								<Link className='border-white/60 text-sm h-10 border-2 px-4 py-2.5 leading-5 font-semibold text-white rounded-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-medium bg-default text-foreground hover:bg-default/80' href='#details'>
									See Details
								{<span className='bg-white pointer-events-none flex h-[22px] w-[22px] items-center justify-center rounded-full'>
											<IconArrowRight className='text-default-foreground [&>path]:stroke-[2.5]' width={16} />
										</span>}</Link>
							</div>
						</div>

						<div className='relative'>
							<div className='absolute -inset-4 rounded-2xl bg-brand-400/25 blur-2xl' />
							<div className='relative rounded-2xl border border-white/10 bg-white/10 p-6 backdrop-blur'>
								<div className='flex items-center justify-between'>
									<div className='text-white/70 text-xs uppercase tracking-wider'>Commission Rate</div>
									<IconCoin className='text-white/70' size={18} />
								</div>
								<div className='mt-4 grid grid-cols-2 gap-4'>
									<div className='rounded-xl border border-white/10 bg-white/10 p-4'>
										<p className='text-xs text-white/70'>30.0% of sale</p>
										<p className='text-2xl font-bold text-white'>Recurring</p>
									</div>
									<div className='rounded-xl border border-white/10 bg-white/10 p-4'>
										<p className='text-xs text-white/70'>Cookie Duration</p>
										<p className='text-2xl font-bold text-white'>30 days</p>
									</div>
									<div className='rounded-xl border border-white/10 bg-white/10 p-4'>
										<p className='text-xs text-white/70'>Payouts</p>
										<p className='text-2xl font-bold text-white'>Monthly</p>
									</div>
									<div className='rounded-xl border border-white/10 bg-white/10 p-4'>
										<p className='text-xs text-white/70'>Tracking</p>
										<p className='text-2xl font-bold text-white'>Realtime</p>
									</div>
								</div>

								<div className='mt-6 flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 p-4'>
									<div className='h-9 w-9 rounded-full bg-white/15 flex items-center justify-center'>
										<IconUsers size={18} className='text-white/80' />
									</div>
									<div>
										<p className='text-sm text-white font-semibold'>Earn by sharing</p>
										<p className='text-xs text-white/60'>Get paid for sharing a tool you already use</p>
									</div>
								</div>
							</div>
						</div>
					</section>
				</main>
			</div>
			<div id='details' />
			<div className='w-full bg-background py-24 px-4'>
				<div className='max-w-6xl mx-auto'>
					<div className='text-center mb-16'>
						<Chip color='accent' className='mb-4'>
							Referral Program
						</Chip>
						<h2 className='text-4xl font-bold mb-4'>Share Clipify with friends and get rewarded</h2>
						<p className='text-muted text-lg max-w-2xl mx-auto'>Invite other creators to try Clipify and earn when they upgrade to a paid plan. Simple links, clear tracking and payouts that are easy to understand.</p>
					</div>
					<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16'>
						<FeatureCard title='Accessible to All' description='Everyone can join the program right away without any special prerequisites.' icon={IconUsers} />
						<FeatureCard title='Effortless Referral Links' description='Your personal referral link is easy to share and works seamlessly across all platforms.' icon={IconLink} />
						<FeatureCard title='Accurate 30-Day Tracking' description='Cookies remain active for 30 days, ensuring you receive commissions even if the user decides to upgrade later.' icon={IconClock} />
						<FeatureCard title='Earnings for Life' description='Receive commissions on every payment from users who subscribe through your referral link.' icon={IconRepeat} />
						<FeatureCard title='Clear Statistics' description='Monitor clicks, signups, and conversions directly in your partner dashboard.' icon={IconChartBar} />
						<FeatureCard title='Straightforward Payouts' description='Your earnings are displayed transparently in your dashboard with simple rules.' icon={IconReportMoney} />
					</div>
				</div>
			</div>
			<div className='flex flex-col items-center text-center'>
				<h3 className='text-2xl font-bold mb-3'>Ready to start earning with Clipify?</h3>
				<p className='text-muted max-w-xl mb-6'>Sign up once, get your referral link instantly and earn recurring commission on every paid subscription you refer.</p>
				<Link href='https://affiliate.clipify.us/register' className='bg-default-foreground text-background font-semibold px-10 py-4 text-base rounded-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 font-medium bg-accent text-accent-foreground hover:bg-accent-hover'>
					Join the Affiliate Program
				</Link>
			</div>
			<div id='faq' />
			<div className='w-full bg-background py-24 px-4'>
				<div className='max-w-6xl mx-auto'>
					<div className='text-center mb-16'>
						<Chip color='accent' className='mb-4'>
							FAQs
						</Chip>
						<h2 className='text-4xl font-bold mb-4'>Frequently Asked Questions</h2>
						<p className='text-muted text-lg max-w-2xl mx-auto'>Find answers to the most common questions about Clipify.</p>
					</div>
					<Accordion allowsMultipleExpanded variant='default'>
						{faqs.map((item, i) => (
							<Accordion.Item key={item.title} id={String(i)}>
								<Accordion.Heading>
									<Accordion.Trigger className='px-6 py-5 text-base md:py-6'>
										<span>{item.title}</span>
										<Accordion.Indicator><IconChevronDown width={24} /></Accordion.Indicator>
									</Accordion.Trigger>
								</Accordion.Heading>
								<Accordion.Panel>
									<Accordion.Body className='px-6 pb-6 text-base leading-relaxed'>{item.content}</Accordion.Body>
								</Accordion.Panel>
							</Accordion.Item>
						))}
					</Accordion>
				</div>
			</div>
			<Footer />
		</>
	);
}
