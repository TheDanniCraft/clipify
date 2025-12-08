"use client";

import { Accordion, AccordionItem, Button, Chip } from "@heroui/react";
import { IconArrowRight, IconChartBar, IconChevronDown, IconClock, IconLink, IconRepeat, IconReportMoney, IconUsers } from "@tabler/icons-react";
import FeatureCard from "../components/featureCard";
import Link from "next/link";
import Footer from "@components/footer";
import faqs from "@components/AffiliatePage/faqs";
import BasicNavbar from "@components/LandingPage/basicNavbar";

export default function AffiliateProgram() {
	return (
		<>
			<div className='bg-gradient-to-br from-primary-800 to-primary-400 h-screen relative flex flex-col overflow-hidden'>
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

				<main className='container mx-auto flex flex-1 flex-col items-center justify-center overflow-hidden px-8'>
					<section className='z-20 flex flex-col items-center justify-center gap-[18px] sm:gap-6'>
						<Button className='border-default-100 bg-default-50 text-small text-default-500 h-9 overflow-hidden border-1 px-[18px] py-2 leading-5 font-normal' endContent={<IconArrowRight className='flex-none outline-hidden [&>path]:stroke-2' width={20} />} radius='full' variant='bordered'>
							New Affiliate Program
						</Button>

						<div className='text-center text-[clamp(40px,10vw,44px)] leading-[1.2] font-bold tracking-tighter sm:text-[64px]'>
							<div className='bg-hero-section-title bg-clip-text text-transparent'>
								Earn by recommending
								<br />
								tools you already use.
							</div>
						</div>

						<p className='text-default-500 text-center leading-7 font-normal sm:w-[466px] sm:text-[18px]'>Share our platform with other creators and earn on every paid signup. Simple links, clear tracking and transparent payouts.</p>

						<div className='flex flex-col items-center justify-center gap-6 sm:flex-row'>
							<Button className='bg-default-foreground text-small text-background h-10 w-[163px] px-[16px] py-[10px] leading-5 font-semibold' radius='full' as={Link} href='https://affiliate.clipify.us/register'>
								Join Now
							</Button>

							<Button
								className='border-white text-small h-10 w-[163px] border-2 px-4 py-2.5 leading-5 font-semibol	d'
								endContent={
									<span className='bg-white pointer-events-none flex h-[22px] w-[22px] items-center justify-center rounded-full'>
										<IconArrowRight className='text-default-50 [&>path]:stroke-[2.5]' width={16} />
									</span>
								}
								radius='full'
								variant='bordered'
								as={Link}
								href='#details'
							>
								See Details
							</Button>
						</div>
					</section>
				</main>
			</div>
			<div id='details' />
			<div className='w-full bg-background py-24 px-4'>
				<div className='max-w-6xl mx-auto'>
					<div className='text-center mb-16'>
						<Chip color='primary' className='mb-4'>
							Referral Program
						</Chip>
						<h2 className='text-4xl font-bold mb-4'>Share Clipify with friends and get rewarded</h2>
						<p className='text-foreground-500 text-lg max-w-2xl mx-auto'>Invite other creators to try Clipify and earn when they upgrade to a paid plan. Simple links, clear tracking and payouts that are easy to understand.</p>
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
				<p className='text-default-500 max-w-xl mb-6'>Sign up once, get your referral link instantly and earn recurring commission on every paid subscription you refer.</p>
				<Button as={Link} href='https://affiliate.clipify.us/register' radius='full' className='bg-default-foreground text-background font-semibold px-10 py-4 text-base'>
					Join the Affiliate Program
				</Button>
			</div>
			<div id='faq' />
			<div className='w-full bg-background py-24 px-4'>
				<div className='max-w-6xl mx-auto'>
					<div className='text-center mb-16'>
						<Chip color='primary' className='mb-4'>
							FAQs
						</Chip>
						<h2 className='text-4xl font-bold mb-4'>Frequently Asked Questions</h2>
						<p className='text-foreground-500 text-lg max-w-2xl mx-auto'>Find answers to the most common questions about Clipify.</p>
					</div>
					<Accordion
						fullWidth
						keepContentMounted
						className='gap-3'
						itemClasses={{
							base: "px-6 !bg-transparent hover:!bg-default-100 !shadow-none data-[open=true]:!bg-default-100",
							title: "font-medium",
							trigger: "py-4 md:py-6",
							content: "pt-0 pb-6 text-base text-default-500",
							indicator: "data-[open=true]:rotate-180",
						}}
						items={faqs}
						selectionMode='multiple'
						variant='splitted'
					>
						{faqs.map((item, i) => (
							<AccordionItem key={i} indicator={<IconChevronDown width={24} />} title={item.title}>
								{item.content}
							</AccordionItem>
						))}
					</Accordion>
				</div>
			</div>
			<Footer />
		</>
	);
}
