"use client";

import BasicNavbar from "@components/LandingPage/basicNavbar";
import { Accordion, AccordionItem, Button, Chip, Image, Link, Card, CardHeader, CardBody } from "@heroui/react";
import { LazyMotion, motion, domAnimation, AnimatePresence } from "motion/react";
import { IconThumbUp, IconArrowRight, IconPlugConnected, IconLayersDifference, IconMoodSmile, IconCoin, IconAdjustments, IconChevronDown } from "@tabler/icons-react";
import FeatureCard from "@components/featureCard";
import TiersComponent from "@components/Pricing";
import faqs from "@components/LandingPage/faqs";
import Footer from "@components/footer";
import FloatingBanner from "@components/floatingBanner";
import DemoPlayer from "@components/DemoPlayer";

export default function Home() {
	return (
		<>
			<script src='//tag.goadopt.io/injector.js?website_code=792b9b29-57f9-4d92-b5f1-313f94ddfacc' className='adopt-injector' defer></script>
			<FloatingBanner
				icon={<Image alt='Tada Icon' src='https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Activities/Party%20Popper.png' width='50' height='50' className='mx-auto' />}
				title="We're launched!"
				text='50% off for early-bird users'
				cta={
					<Button as={Link} href='/#pricing' radius='full' className='h-9 px-4 bg-white text-black'>
						Claim Offer
					</Button>
				}
			/>

			<div className='bg-gradient-to-br from-primary-800 to-primary-400 h-full'>
				<BasicNavbar />
				<div id='#' className='relative flex h-screen min-h-dvh w-full flex-col overflow-hidden'>
					<main className='container mx-auto mt-[80px] flex max-w-[1024px] flex-col items-start px-8'>
						<section className='z-20 flex flex-col items-start justify-center gap-[18px] sm:gap-6'>
							<LazyMotion features={domAnimation}>
								<motion.div
									animate='kick'
									className='flex flex-col gap-6'
									exit='auto'
									initial='auto'
									transition={{
										duration: 0.25,
										ease: "easeInOut",
									}}
									variants={{
										auto: { width: "auto" },
										kick: { width: "auto" },
									}}
								>
									<AnimatePresence mode='wait'>
										<motion.div
											key='hero-section-title'
											animate={{ filter: "blur(0px)", opacity: 1, x: 0 }}
											className='text-start text-[clamp(40px,10vw,44px)] font-bold leading-[1.2] tracking-tighter sm:text-[64px] text-white'
											initial={{ filter: "blur(16px)", opacity: 0.1, x: 15 + 1 * 2 }}
											transition={{
												bounce: 0,
												delay: 0.01 * 10,
												duration: 0.8 + 0.1 * 8,
												type: "spring",
											}}
										>
											<div>
												<h1>
													Let your clips talk.
													<br />
													Even when you can&apos;t.
												</h1>
											</div>
										</motion.div>

										<motion.div
											key='hero-section-description'
											animate={{ filter: "blur(0px)", opacity: 1, x: 0 }}
											className='text-start font-normal leading-7 text-zinc-300 sm:w-[466px] sm:text-[18px]'
											initial={{ filter: "blur(16px)", opacity: 0.1, x: 15 + 1 * 3 }}
											transition={{
												bounce: 0,
												delay: 0.01 * 30,
												duration: 0.8 + 0.1 * 9,
												type: "spring",
											}}
										>
											Need a break? Clipify got you covered. Auto-play clips while you are away - keep your stream alive and your viewers entertained.
										</motion.div>

										<motion.div
											key='hero-section-buttons'
											animate={{ filter: "blur(0px)", opacity: 1, x: 0 }}
											className='flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6'
											initial={{ filter: "blur(16px)", opacity: 0.1, x: 15 + 1 * 4 }}
											transition={{
												bounce: 0,
												delay: 0.01 * 50,
												duration: 0.8 + 0.1 * 10,
												type: "spring",
											}}
										>
											<Button className='h-10 w-[163px] bg-white px-[16px] py-[10px] text-small font-medium leading-5 text-black' radius='full' as={Link} href='/login'>
												Get Started
											</Button>
											<Button
												className='h-10 w-[163px] border-1 border-white px-[16px] py-[10px] text-small font-medium leading-5 text-white'
												endContent={
													<span className='pointer-events-none flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white'>
														<IconArrowRight className='text-black' width={16} />
													</span>
												}
												radius='full'
												variant='bordered'
												as={Link}
												href='#pricing'
											>
												See our plans
											</Button>
										</motion.div>
									</AnimatePresence>
								</motion.div>
							</LazyMotion>
						</section>
					</main>
					<motion.div
						key='hero-section-app-screenshot'
						animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
						className='relative h-full flex justify-center'
						initial={{ filter: "blur(16px)", opacity: 0.1, y: 300 }}
						transition={{
							bounce: 0,
							delay: 0.01 * 10,
							duration: 0.8 + 0.1 * 8,
							type: "spring",
						}}
					>
						<div className='aspect-[16/9] w-auto h-full flex justify-center'>
							<Image src='./appSkew.webp' alt='App Screenshot' className='w-full h-full object-cover' loading='eager' fetchPriority='high' />
						</div>
					</motion.div>
				</div>
			</div>
			<div id='features' />
			<div className='w-full bg-background py-24 px-4'>
				<div className='max-w-6xl mx-auto'>
					<div className='text-center mb-16'>
						<Chip color='primary' className='mb-4'>
							Features
						</Chip>
						<h2 className='text-4xl font-bold mb-4'>Play your Twitch clips, keep your stream alive</h2>
						<p className='text-foreground-500 text-lg max-w-2xl mx-auto'>Clipify automatically plays your best Twitch clips to keep your channel active and your viewers engaged-even when you&apos;re away.</p>
					</div>
					<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16'>
						<FeatureCard title='Easy to Use' description='Intuitive interface designed for effortless setup and management.' icon={IconThumbUp} />
						<FeatureCard title='Plug & Play' description="It's as easy as adding a browser source to your streaming software." icon={IconPlugConnected} />
						<FeatureCard title='Customize your player' description='Choose to play clips from today, all-time, or just your featured clips.' icon={IconAdjustments} />
						<FeatureCard title='Keeps Your Stream Entertained' description="Auto-play clips to keep your audience engaged even when you're away." icon={IconMoodSmile} />
						<FeatureCard title='Multiple Overlays' description='Create as many overlays as you like, use them for AFK screens, at the starting or end screens of your stream, or anywhere you want.' icon={IconLayersDifference} />
						<FeatureCard title='Channel Points Integration' description='Let viewers play their favourite clips using Twitch channel points.' icon={IconCoin} />
					</div>
				</div>
			</div>
			<div id='pricing' />
			<div className='w-full bg-background py-24 px-4'>
				<div className='max-w-6xl mx-auto'>
					<div className='text-center mb-16'>
						<Chip color='primary' className='mb-4'>
							Pricing
						</Chip>
						<h2 className='text-4xl font-bold mb-4'>Complicated pricing? Not with us.</h2>
						<p className='text-foreground-500 text-lg max-w-2xl mx-auto'>Just two options: free forever, or unlock everything with Pro.</p>

						<div className='mx-auto w-full max-w-md mt-12'>
							<div className='relative'>
								{/* Gradient Glow Layer */}
								<div className='absolute -inset-1 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 blur-2xl opacity-60'></div>

								<Card className='relative bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl shadow-lg'>
									<CardHeader className='p-4 pb-2'>
										<div className='flex items-center gap-2 rounded-none'>
											<Image alt='Launch Icon' className='rounded-none' src='https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Rocket.png' width={28} />
											<h2 className='text-[17px] md:text-[18px] font-semibold leading-[1.1] tracking-tight'>Launch Offer</h2>
										</div>
									</CardHeader>

									<CardBody className='px-4 pb-4 space-y-3'>
										<p className='text-base'>
											Use <span className='font-bold bg-white text-purple-700 px-2 py-0.5 rounded'>EARLYCLIPPY</span> for <strong>50% OFF</strong> your first year.
										</p>

										<Button as={Link} href='/login' className='w-full bg-white text-purple-700 font-medium py-2 rounded-lg hover:opacity-90 transition'>
											Register To Claim Offer
										</Button>
									</CardBody>
								</Card>
							</div>
						</div>
					</div>
				</div>
				<TiersComponent />
			</div>
			<div id='demo' />
			<div className='w-full bg-background py-24 px-4'>
				<div className='max-w-6xl mx-auto'>
					<div className='text-center mb-16'>
						<Chip color='primary' className='mb-4'>
							Interactive Demo
						</Chip>
						<h2 className='text-4xl font-bold mb-4'>See Clipify in action</h2>
						<p className='text-foreground-500 text-lg max-w-2xl mx-auto'>Try our live demo to preview how clips play and how overlays behave on your stream.</p>
					</div>
					<DemoPlayer />
				</div>
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
