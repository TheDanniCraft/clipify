"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button, Card, Separator, Form, Input, Link, Modal, Spinner, TextField, Label, FieldError, InputGroup } from "@heroui/react";
import Image from "next/image";

import { Turnstile } from "nextjs-turnstile";
import { motion } from "motion/react";

import Logo from "@components/logo";
import CommunityTeaser from "@components/LandingPage/communityTeaser";
import { IconCircleCheckFilled, IconMailFilled, IconMoonFilled, IconSend, IconSunFilled } from "@tabler/icons-react";
import { useTheme } from "next-themes";
import axios from "axios";
import { getPublicCommunityFooterTeaserAction } from "@actions/community";
import { getEmailProvider, subscribeToNewsletter } from "@actions/newsletter";
import { usePlausible } from "next-plausible";
import { isRatelimitError } from "@actions/rateLimit";
import type { CommunityTeaserStreamer } from "@lib/community-types";
import { ConsentDialogLink } from "@c15t/nextjs/components/consent-dialog-link";
import { legalDocumentRoutes } from "@lib/legal/documents";

const isE2ETestMode = process.env.E2E_TEST_MODE === "true";

export default function Footer() {
	const { setTheme } = useTheme();
	const [statusColor, setStatusColor] = useState("#ffffff");
	const [statusText, setStatusText] = useState(isE2ETestMode ? "Test environment" : "Loading...");
	const [footerCommunityPreview, setFooterCommunityPreview] = useState<CommunityTeaserStreamer[] | null>(null);
	const plausible = usePlausible();
	const [newsletterState, setNewsletterState] = useState("default");
	const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
	const [isSuccessOpen, setIsSuccessOpen] = useState(false);
	const [token, setToken] = useState<string | null>(null);
	const mounted = useSyncExternalStore(
		() => () => undefined,
		() => true,
		() => false,
	);
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

	const emailSubmitDisabled = newsletterState === "loading" || newsletterState === "success" || (mounted && !token);
	const detailSubmitDisabled = newsletterState === "loading" || !pendingEmail || (mounted && !token);

	const communityStreamers = useMemo(() => footerCommunityPreview ?? [], [footerCommunityPreview]);
	const footerNavigation = {
		features: [
			{ name: "Easy to Use", href: "#features" },
			{ name: "Plug & Play", href: "#features" },
			{ name: "Customize your player", href: "#features" },
			{ name: "Multiple Overlays", href: "#features" },
			{ name: "Channel Points Integration", href: "#features" },
		],
		supportOptions: [
			{ name: "Pricing", href: "/pricing" },
			{ name: "FAQs", href: "#faq" },
			{ name: "Community", href: "/community" },
			{ name: "Help Center", href: "https://help.clipify.us/" },
			{ name: "Service Status", href: "https://status.thedannicraft.de/status/clipify" },
		],
		aboutUs: [
			{ name: "Latest News", href: "/changelog" },
			{ name: "Roadmap", href: "/roadmap" },
			{ name: "Collaborations", href: "https://help.clipify.us/hc/clipify/articles/1756597294-collaborations" },
			{ name: "Climate Initiative", href: "https://climate.stripe.com/FaGAVC" },
		],
		legal: [
			{ name: "Imprint", href: legalDocumentRoutes.imprint },
			{ name: "Privacy Policy", href: legalDocumentRoutes.privacy },
			{ name: "Cookie Policy", href: legalDocumentRoutes.cookies },
			{ name: "Terms of Service", href: legalDocumentRoutes.terms },
			{ name: "Request Data Removal", href: legalDocumentRoutes.privacyRequests },
		],
	};

	useEffect(() => {
		if (isE2ETestMode) return;
		axios
			.get("https://api.status.thedannicraft.de/clipify", {})
			.then((response) => {
				switch (response.data.status) {
					case "DOWN":
						setStatusColor("var(--danger)");
						setStatusText("Major outage");
						break;
					case "UP":
						setStatusColor("var(--success)");
						setStatusText("All systems operational");
						break;
					case "PARTIAL":
						setStatusColor("var(--warning)");
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
		if (isE2ETestMode) return;
		let cancelled = false;

		async function loadCommunityPreview() {
			const streamers = await getPublicCommunityFooterTeaserAction();

			if (!cancelled) {
				setFooterCommunityPreview(streamers);
			}
		}

		loadCommunityPreview().catch((error) => {
			console.error("Error fetching community preview:", error);
			if (!cancelled) {
				setFooterCommunityPreview(null);
			}
		});

		return () => {
			cancelled = true;
		};
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

	const finishSubscribe = useCallback(
		async (includeNames = true) => {
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
		},
		[firstName, pendingEmail, plausible, token],
	);

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
				<h3 className='text-sm text-muted font-semibold'>{title}</h3>
				<ul className='mt-2 space-y-0.5'>
					{items.map((item) => (
						<li key={item.name}>
							<Link className='text-muted text-sm' href={item.href}>
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
			<footer className='flex w-full flex-col pb-16'>
				<Separator />
				<div className='mx-auto max-w-7xl px-6 pt-16 pb-8 sm:pt-24 lg:px-8 lg:pt-32'>
					<div className='xl:grid xl:grid-cols-3 xl:gap-8'>
						<div className='space-y-6 md:pr-8'>
							<div className='flex items-center justify-start'>
								<Logo size={34} />
								<span className='text-sm font-medium'>Clipify</span>
							</div>
							<div className='space-y-4'>
								<p className='text-sm text-muted'>Need a break? Clipify got you covered. Auto-play clips while you are away - keep your stream alive and your viewers entertained.</p>
								{communityStreamers.length > 0 ? (
									<Link href='/community' className='inline-flex max-w-fit flex-col items-start gap-2 rounded-[14px] border border-default/80 bg-surface-secondary/70 px-3 py-2 transition hover:border-default hover:bg-surface-secondary'>
										<div className='space-y-0.5 text-left'>
											<p className='text-sm font-semibold text-foreground'>Clipify community</p>
											<p className='text-[11px] text-muted'>
												{communityStreamers.length} streamer{communityStreamers.length === 1 ? "" : "s"}
											</p>
										</div>
										<CommunityTeaser streamers={communityStreamers} countClassName='ml-2 text-[11px] font-medium text-muted' />
									</Link>
								) : null}
							</div>
						</div>
						<div className='mt-4 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0'>
							<div className='md:grid md:grid-cols-2 md:gap-8'>
								<div>{renderList({ title: "Features", items: footerNavigation.features })}</div>
								<div className='mt-10 md:mt-0'>{renderList({ title: "Support", items: footerNavigation.supportOptions })}</div>
							</div>
							<div className='md:grid md:grid-cols-2 md:gap-8'>
								<div>{renderList({ title: "About Us", items: footerNavigation.aboutUs })}</div>
								<div className='mt-10 md:mt-0'>
									{renderList({ title: "Legal", items: footerNavigation.legal })}
									<ConsentDialogLink className='link mt-1 text-sm text-muted'>Cookie preferences</ConsentDialogLink>
								</div>
							</div>
						</div>
					</div>

					<Card variant='secondary' className='mt-4 mb-10 sm:mt-6 sm:mb-14 lg:mt-8 lg:mb-16'>
						<Card.Content className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
							<div className='shrink-0'>
								<h3 className='text-sm text-muted font-semibold'>Subscribe to our newsletter</h3>
								<p className='text-sm text-muted mt-2'>Receive updates on new features, tips and tricks, or offers straight to your email.</p>
							</div>
							<div className='w-full lg:max-w-md'>
								<Form className='w-full space-y-3' onSubmit={handleNewsletterSubmit}>
									<motion.div
										className='relative w-full'
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
											<TextField fullWidth isRequired type='email' className={newsletterState == "success" ? "text-success" : newsletterState == "error" || newsletterState == "rateLimit" ? "text-danger" : "text-foreground"} name='email' isDisabled={newsletterState === "loading" || newsletterState === "success"}>
												<InputGroup fullWidth variant='secondary'>
													<InputGroup.Prefix>
														{(() => {
															switch (newsletterState) {
																case "loading":
																	return <Spinner />;
																case "success":
																	return <IconCircleCheckFilled className='text-success' />;
																default:
																	return <IconMailFilled className='text-muted' />;
															}
														})()}
													</InputGroup.Prefix>
													<InputGroup.Input
														placeholder='mail@example.com'
														onChange={() => {
															setNewsletterState("default");
														}}
													/>
													<InputGroup.Suffix>
														{
															<Button size='sm' isIconOnly type='submit' isDisabled={emailSubmitDisabled} aria-label='Continue newsletter signup' variant='primary'>
																<IconSend className='text-white' />
															</Button>
														}
													</InputGroup.Suffix>
												</InputGroup>
												<FieldError />
											</TextField>
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
											<div className='rounded-[8px] border border-default px-3 py-2 text-xs text-muted'>Subscribing as {pendingEmail}</div>
											<TextField fullWidth>
												<Label>How should we call you?</Label>
												<Input fullWidth variant='secondary' placeholder={firstNamePlaceholder} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
											</TextField>
											<div className='flex flex-wrap items-center gap-2'>
												<Button
													type='button'
													variant='tertiary'
													onPress={() => {
														setIsDetailsExpanded(false);
														setNewsletterState("default");
													}}
													isDisabled={newsletterState === "loading"}
												>
													Back
												</Button>
												<Button type='button' variant='tertiary' onPress={() => finishSubscribe(false)} isDisabled={detailSubmitDisabled}>
													Skip
												</Button>
												<Button type='submit' isDisabled={detailSubmitDisabled} variant='primary'>
													Add and subscribe
												</Button>
											</div>
										</motion.div>
									</motion.div>
									{!isE2ETestMode && (
										<div className='pt-1'>
											<Turnstile siteKey='0x4AAAAAACMFR636JljxhVLl' onSuccess={setToken} onError={(error) => console.error("Turnstile error:", error)} onExpire={() => setToken(null)} />
										</div>
									)}
									{newsletterState === "loading" && <p className='text-xs text-muted pt-1'>Subscribing...</p>}
									{newsletterState === "captcha" && <p className='text-xs text-muted pt-1'>Please complete the CAPTCHA first.</p>}
									{newsletterState === "error" && <p className='text-xs text-danger pt-1'>Could not subscribe right now. Please try again.</p>}
									{newsletterState === "rateLimit" && <p className='text-xs text-danger pt-1'>Too many attempts. Please wait a moment.</p>}
								</Form>
							</div>
						</Card.Content>
					</Card>
					<Modal>
						<Modal.Backdrop isOpen={isSuccessOpen} onOpenChange={setIsSuccessOpen}>
							<Modal.Container>
								<Modal.Dialog>
									<Modal.CloseTrigger />
									<Modal.Body>
										<div className='p-6'>
											<div className='text-success mt-2 text-center'>
												<Image unoptimized alt='Tada Icon' src='https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Activities/Party%20Popper.png' width={50} height={50} className='mx-auto' />
												<p className='text-lg font-bold'>You&apos;re almost there!</p>
												<p className='text-xs'>We&apos;ve just sent a confirmation email your way. Check your inbox to finish subscribing-and if you don&apos;t see it, be sure to take a quick look in your spam folder too.</p>
											</div>
										</div>
									</Modal.Body>
								</Modal.Dialog>
							</Modal.Container>
						</Modal.Backdrop>
					</Modal>

					<div className='flex flex-wrap justify-between gap-2 pt-8'>
						<div>
							<div className='flex items-center justify-center gap-3 md:justify-start'>
								<Link href='https://status.thedannicraft.de/status/clipify' className='text-muted'>
									<span className='inline-flex items-center gap-2 text-xs font-medium'>
										<span aria-hidden className='h-2 w-2 rounded-full' style={{ backgroundColor: statusColor }} />
										<span>{statusText}</span>
									</span>
								</Link>
							</div>
							<p className='text-center text-xs text-muted md:text-start'>&copy; {new Date().getFullYear()} TheDanniCraft. All rights reserved.</p>
						</div>

						<div role='group' aria-label='Color theme' className='flex w-fit gap-1 rounded-full border border-default p-1'>
							<Button isIconOnly size='sm' variant='ghost' aria-label='Switch to dark theme' onPress={() => setTheme("dark")}>
								<IconMoonFilled />
							</Button>
							<Button isIconOnly size='sm' variant='ghost' aria-label='Switch to light theme' onPress={() => setTheme("light")}>
								<IconSunFilled />
							</Button>
						</div>
					</div>
				</div>
			</footer>
		</>
	);
}
