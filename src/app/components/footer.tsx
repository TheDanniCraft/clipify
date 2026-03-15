"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Chip, Divider, Form, Image, Input, Link, Modal, ModalContent, Spinner, Tab, Tabs } from "@heroui/react";
import { Turnstile } from "nextjs-turnstile";
import { motion } from "motion/react";

import Logo from "@components/logo";
import { IconCircleCheckFilled, IconMailFilled, IconMoonFilled, IconSend, IconSunFilled } from "@tabler/icons-react";
import { useTheme } from "next-themes";
import axios from "axios";
import { getEmailProvider, subscribeToNewsletter } from "@actions/newsletter";
import { usePlausible } from "next-plausible";
import { isRatelimitError } from "@actions/rateLimit";

export default function Footer() {
	const { theme, setTheme } = useTheme();
	const [statusColor, setStatusColor] = useState("#ffffff");
	const [statusText, setStatusText] = useState("Loading...");
	const plausible = usePlausible();
	const [newsletterState, setNewsletterState] = useState("default");
	const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
	const [isSuccessOpen, setIsSuccessOpen] = useState(false);
	const [token, setToken] = useState<string | null>(null);
	const [pendingEmail, setPendingEmail] = useState("");
	const [firstName, setFirstName] = useState("");
	const emailStepRef = useRef<HTMLDivElement>(null);
	const nameStepRef = useRef<HTMLDivElement>(null);
	const [stepHeights, setStepHeights] = useState({ email: 64, name: 172 });
	const firstNamePlaceholder = useMemo(() => {
		const localPart = (pendingEmail.split("@")[0] || "").trim();
		if (!localPart) {
			return "First name";
		}

		const stopWords = new Set(["the", "real", "official", "its", "iam", "im", "hello", "mail", "contact", "team", "info", "admin", "support", "noreply", "no", "reply"]);
		const normalized = localPart
			.split("+")[0]
			.replace(/([a-z])([A-Z])/g, "$1 $2")
			.split(/[._\-\s]+/)
			.map((part) => part.replace(/[^\p{L}]/gu, "").toLowerCase())
			.filter((part) => part.length > 1 && !stopWords.has(part));

		if (!normalized.length) {
			return "First name";
		}

		const guess = normalized[0];
		return guess.charAt(0).toUpperCase() + guess.slice(1);
	}, [pendingEmail]);

	const measureStepHeights = useCallback(() => {
		const emailHeight = emailStepRef.current?.scrollHeight ?? 64;
		const nameHeight = nameStepRef.current?.scrollHeight ?? 172;
		setStepHeights({ email: emailHeight, name: nameHeight });
	}, []);

	const productHuntSrc = useMemo(() => `https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1052781&theme=${theme === "light" ? "light" : "dark"}`, [theme]);

	const footerNavigation = {
		features: [
			{ name: "Easy to Use", href: "#features" },
			{ name: "Plug & Play", href: "#features" },
			{ name: "Customize your player", href: "#features" },
			{ name: "Multiple Overlays", href: "#features" },
			{ name: "Channel Points Integration", href: "#features" },
		],
		supportOptions: [
			{ name: "Pricing", href: "#pricing" },
			{ name: "FAQs", href: "#faq" },
			{ name: "Help Center", href: "https://help.clipify.us/" },
			{ name: "Service Status", href: "https://status.thedannicraft.de/status/clipify" },
		],
		aboutUs: [
			{ name: "Latest News", href: "/changelog" },
			{ name: "Roadmap", href: "/roadmap" },
			{ name: "Collaborations", href: "https://help.clipify.us/hc/clipify/articles/1756597294-collaborations" },
			{ name: "Referral Program", href: "/referral-program" },
			{ name: "Climate Initiative", href: "https://climate.stripe.com/FaGAVC" },
		],
		legal: [
			{ name: "Imprint", href: "/imprint" },
			{ name: "Privacy Policy", href: "https://hub.goadopt.io/document/3852d930-97b9-46c2-950d-823e62515ab4?language=en" },
			{ name: "Cookie Policy", href: "https://hub.goadopt.io/document/535d4dc1-7b66-4b96-9bff-bc6e0e47587d?language=en" },
			{ name: "Terms of Service", href: "https://hub.goadopt.io/document/9651af3f-af45-480f-8a4d-2beb6ed68e9b?language=en" },
			{ name: "Request Data Removal", href: "https://hub.goadopt.io/privacy-hub/07b752d8-6dc2-4831-9c53-b5038623ddf4?language=en&legislation=gdpr&websiteId=b03e3c81-5d51-4e76-8610-8259e1b06086&disclaimerId=792b9b29-57f9-4d92-b5f1-313f94ddfacc&visitorId=9b705dd6-cc3e-4a91-9dad-f7acb8bd6a7c" },
		],
	};

	useEffect(() => {
		axios
			.get("https://api.status.thedannicraft.de/clipify", {})
			.then((response) => {
				switch (response.data.status) {
					case "DOWN":
						setStatusColor("hsl(var(--heroui-danger))");
						setStatusText("Major outage");
						break;
					case "UP":
						setStatusColor("hsl(var(--heroui-success))");
						setStatusText("All systems operational");
						break;
					case "PARTIAL":
						setStatusColor("hsl(var(--heroui-warning))");
						setStatusText("Partial outage");
						break;
					case "MAINTENANCE":
						setStatusColor("#006FEE");
						setStatusText("Under maintenance");
						break;
				}
			})
			.catch((error) => {
				console.error("Error fetching service status:", error);

				setStatusColor("#ffffff");
				setStatusText("Service status unknown");
			});
	}, []);

	useEffect(() => {
		const frame = window.requestAnimationFrame(measureStepHeights);
		return () => window.cancelAnimationFrame(frame);
	}, [measureStepHeights, firstName, pendingEmail, newsletterState]);

	useEffect(() => {
		const handleResize = () => measureStepHeights();
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, [measureStepHeights]);

	const subscribe = useCallback(
		(event: React.FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const data = Object.fromEntries(new FormData(event.currentTarget));
			const email = ((data.email as string) || "").trim();
			if (!email) {
				setPendingEmail(email);
				setNewsletterState("default");
				setIsDetailsExpanded(false);
				return;
			}
			if (!token) {
				setPendingEmail(email);
				setNewsletterState("captcha");
				setIsDetailsExpanded(false);
				return;
			}
			setPendingEmail(email);
			setFirstName("");
			setNewsletterState("default");
			setIsDetailsExpanded(true);
		},
		[token],
	);

	const finishSubscribe = useCallback(async (includeNames = true) => {
		if (!token) {
			setNewsletterState("error");
			return;
		}
		setNewsletterState("loading");

		try {
			const res = await subscribeToNewsletter(
				pendingEmail,
				token || "",
				includeNames
					? {
							firstName: firstName.trim() || undefined,
						}
					: undefined,
			);

			if (await isRatelimitError(res)) {
				setNewsletterState("rateLimit");
				return;
			}
			if (res instanceof Error) {
				setNewsletterState("error");
				return;
			}

			setNewsletterState("success");
			setIsDetailsExpanded(false);
			setIsSuccessOpen(true);

			plausible("Newsletter Subscription", {
				props: {
					emailType: await getEmailProvider(pendingEmail),
				},
			});
		} catch {
			setNewsletterState("error");
		}
	}, [firstName, pendingEmail, plausible, token]);

	const handleNewsletterSubmit = useCallback(
		(event: React.FormEvent<HTMLFormElement>) => {
			if (isDetailsExpanded) {
				event.preventDefault();
				void finishSubscribe(true);
				return;
			}
			subscribe(event);
		},
		[finishSubscribe, isDetailsExpanded, subscribe],
	);

	const renderList = useCallback(
		({ title, items }: { title: string; items: { name: string; href: string }[] }) => (
			<div>
				<h3 className='text-small text-default-600 font-semibold'>{title}</h3>
				<ul className='mt-2 space-y-0.5'>
					{items.map((item) => (
						<li key={item.name}>
							<Link className='text-default-400' href={item.href} size='sm'>
								{item.name}
							</Link>
						</li>
					))}
				</ul>
			</div>
		),
		[],
	);

	return (
		<>
			<Divider className='my-4' />
			<footer className='flex w-full flex-col pb-16'>
				<div className='mx-auto max-w-7xl px-6 pt-16 pb-8 sm:pt-24 lg:px-8 lg:pt-32'>
					<div className='xl:grid xl:grid-cols-3 xl:gap-8'>
						<div className='space-y-8 md:pr-8'>
							<div className='flex items-center justify-start'>
								<Logo size={34} />
								<span className='text-small font-medium'>Clipify</span>
							</div>
							<div>
								<p className='text-small text-default-500'>Need a break? Clipify got you covered. Auto-play clips while you are away - keep your stream alive and your viewers entertained.</p>
								<a href='https://www.producthunt.com/products/clipify-2?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-clipify-us' target='_blank' rel='noopener noreferrer' className='mt-4 inline-block'>
									<Image src={productHuntSrc} alt='Clipify on Product Hunt' className='h-[52px] w-auto' />
								</a>
							</div>
						</div>
						<div className='mt-16 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0'>
							<div className='md:grid md:grid-cols-2 md:gap-8'>
								<div>{renderList({ title: "Features", items: footerNavigation.features })}</div>
								<div className='mt-10 md:mt-0'>{renderList({ title: "Support", items: footerNavigation.supportOptions })}</div>
							</div>
							<div className='md:grid md:grid-cols-2 md:gap-8'>
								<div>{renderList({ title: "About Us", items: footerNavigation.aboutUs })}</div>
								<div className='mt-10 md:mt-0'>{renderList({ title: "Legal", items: footerNavigation.legal })}</div>
							</div>
						</div>
					</div>

					<div className='rounded-medium bg-default-200/20 my-10 p-4 sm:my-14 sm:p-8 lg:my-16 lg:flex lg:items-center lg:justify-between lg:gap-2'>
						<div>
							<h3 className='text-small text-default-600 font-semibold'>Subscribe to our newsletter</h3>
							<p className='text-small text-default-400 mt-2'>Receive updates on new features, tips and tricks, or offers straight to your email.</p>
						</div>
						<div className='w-full lg:max-w-md'>
							<Form onSubmit={handleNewsletterSubmit}>
								<motion.div
									className='relative w-full overflow-hidden'
									animate={{
										height: isDetailsExpanded ? stepHeights.name : stepHeights.email,
									}}
									transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
								>
									<motion.div
										ref={emailStepRef}
										className={isDetailsExpanded ? "absolute inset-0 w-full" : "relative w-full"}
										animate={{
											opacity: isDetailsExpanded ? 0 : 1,
											y: isDetailsExpanded ? -8 : 0,
											pointerEvents: isDetailsExpanded ? "none" : "auto",
										}}
										transition={{ duration: 0.2, ease: "easeOut" }}
									>
										<Input
											isRequired
											placeholder='mail@example.com'
											type='email'
											labelPlacement='outside'
											className={newsletterState == "success" ? "text-success" : newsletterState == "error" || newsletterState == "rateLimit" ? "text-danger" : "text-default-900"}
											startContent={(() => {
												switch (newsletterState) {
													case "loading":
														return <Spinner />;
													case "success":
														return <IconCircleCheckFilled className='text-success-500' />;
													default:
														return <IconMailFilled className='text-default-400' />;
												}
											})()}
											onChange={() => {
												setNewsletterState("default");
											}}
											name='email'
											isDisabled={newsletterState === "loading" || newsletterState === "success"}
											endContent={
												<Button color='primary' size='sm' isIconOnly type='submit' isDisabled={newsletterState === "loading" || newsletterState === "success" || !token} aria-label='Continue newsletter signup'>
													<IconSend className='text-white' />
												</Button>
											}
										/>
									</motion.div>
									<motion.div
										ref={nameStepRef}
										className={isDetailsExpanded ? "relative w-full space-y-3" : "absolute inset-0 w-full space-y-3"}
										animate={{
											opacity: isDetailsExpanded ? 1 : 0,
											y: isDetailsExpanded ? 0 : 8,
											pointerEvents: isDetailsExpanded ? "auto" : "none",
										}}
										transition={{ duration: 0.24, ease: "easeOut" }}
									>
										<div className='rounded-small border border-default-200 px-3 py-2 text-xs text-default-500'>Subscribing as {pendingEmail}</div>
										<Input size='sm' label='How should we call you?' placeholder={firstNamePlaceholder} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
										<div className='flex flex-wrap items-center gap-2'>
											<Button
												type='button'
												variant='light'
												onPress={() => {
													setIsDetailsExpanded(false);
													setNewsletterState("default");
												}}
												isDisabled={newsletterState === "loading"}
											>
												Back
											</Button>
											<Button type='button' variant='flat' onPress={() => finishSubscribe(false)} isDisabled={newsletterState === "loading" || !pendingEmail || !token}>
												Skip
											</Button>
											<Button type='submit' color='primary' isDisabled={newsletterState === "loading" || !pendingEmail || !token}>
												Add and subscribe
											</Button>
										</div>
									</motion.div>
								</motion.div>
								<div className='pt-1'>
									<Turnstile siteKey='0x4AAAAAACMFR636JljxhVLl' onSuccess={setToken} onError={(error) => console.error("Turnstile error:", error)} onExpire={() => setToken(null)} />
								</div>
								{newsletterState === "loading" && <p className='text-xs text-default-500 pt-1'>Subscribing...</p>}
								{newsletterState === "captcha" && <p className='text-xs text-default-500 pt-1'>Please complete the CAPTCHA first.</p>}
								{newsletterState === "error" && <p className='text-xs text-danger pt-1'>Could not subscribe right now. Please try again.</p>}
								{newsletterState === "rateLimit" && <p className='text-xs text-danger pt-1'>Too many attempts. Please wait a moment.</p>}
							</Form>
						</div>
						<Modal isOpen={isSuccessOpen} onOpenChange={(open) => setIsSuccessOpen(open)}>
							<ModalContent>
								<div className='p-6'>
									<div className='text-success-500 mt-2 text-center'>
										<Image alt='Tada Icon' src='https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Activities/Party%20Popper.png' width='50' height='50' className='mx-auto' />
										<p className='text-lg font-bold'>You&apos;re almost there!</p>
										<p className='text-xs'>We&apos;ve just sent a confirmation email your way. Check your inbox to finish subscribing-and if you don&apos;t see it, be sure to take a quick look in your spam folder too.</p>
									</div>
								</div>
							</ModalContent>
						</Modal>
					</div>

					<div className='flex flex-wrap justify-between gap-2 pt-8'>
						<div>
							<div className='flex items-center justify-center gap-3 md:justify-start'>
								<Link href='https://status.thedannicraft.de/status/clipify'>
									<Chip
										className='border-none px-0 text-default-500'
										classNames={{
											dot: "bg-[var(--chip-dot-bg)]",
										}}
										style={
											{
												"--chip-dot-bg": statusColor,
											} as React.CSSProperties
										}
										variant='dot'
									>
										{statusText}
									</Chip>
								</Link>
							</div>
							<p className='text-center text-tiny text-default-400 md:text-start'>&copy; {new Date().getFullYear()} TheDanniCraft. All rights reserved.</p>
						</div>

						<Tabs onSelectionChange={(key) => setTheme(String(key))} color='primary' selectedKey={theme ?? "dark"}>
							<Tab title={<IconMoonFilled />} key='dark' aria-label='Switch to dark theme' />
							<Tab title={<IconSunFilled />} key='light' aria-label='Switch to light theme' />
						</Tabs>
					</div>
				</div>
			</footer>
		</>
	);
}
