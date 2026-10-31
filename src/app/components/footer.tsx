"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Separator, Form, Input, Link, Modal, Spinner, TextField, Label, FieldError, InputGroup } from "@heroui/react";
import Image from "next/image";

import { Turnstile } from "nextjs-turnstile";

import Logo from "@components/logo";
import CommunityTeaser from "@components/LandingPage/communityTeaser";
import { IconCircleCheckFilled, IconMailFilled, IconMoonFilled, IconSend, IconSunFilled } from "@tabler/icons-react";
import { useTheme } from "next-themes";
import axios from "axios";
import { getPublicCommunityFooterTeaserAction } from "@actions/community";
import { getEmailProvider, subscribeToNewsletter } from "@actions/newsletter";
import { trackEvent } from "@lib/analytics";
import { isRatelimitError } from "@actions/rateLimit";
import type { CommunityTeaserPayload } from "@lib/community-types";
import { footerNavigation } from "@lib/footerNavigation";
import { OPEN_CONSENT_PREFERENCES_EVENT } from "@lib/consent/events";

const isE2ETestMode = process.env.E2E_TEST_MODE === "true";

export default function Footer() {
	const { setTheme, resolvedTheme } = useTheme();
	const [statusColor, setStatusColor] = useState("#ffffff");
	const [statusText, setStatusText] = useState(isE2ETestMode ? "Test environment" : "Loading...");
	const [footerCommunityPreview, setFooterCommunityPreview] = useState<CommunityTeaserPayload | null>(null);

	const [newsletterState, setNewsletterState] = useState("default");
	const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
	const [isSuccessOpen, setIsSuccessOpen] = useState(false);
	const [token, setToken] = useState<string | null>(null);

	const [pendingEmail, setPendingEmail] = useState("");
	const [firstName, setFirstName] = useState("");
	const emailStepRef = useRef<HTMLDivElement>(null);
	const [formWidth, setFormWidth] = useState(0);
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

	const measureNewsletterWidth = useCallback(() => {
		setFormWidth(emailStepRef.current?.clientWidth || 300);
	}, []);

	const emailSubmitDisabled = newsletterState === "loading" || newsletterState === "success" || !token;
	const detailSubmitDisabled = newsletterState === "loading" || !pendingEmail || !token;

	const communityStreamers = useMemo(() => footerCommunityPreview?.streamers ?? [], [footerCommunityPreview]);
	const communityStreamerCount = footerCommunityPreview?.totalCount ?? 0;
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
		const frame = window.requestAnimationFrame(measureNewsletterWidth);
		return () => window.cancelAnimationFrame(frame);
	}, [measureNewsletterWidth]);

	useEffect(() => {
		const handleResize = () => measureNewsletterWidth();
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, [measureNewsletterWidth]);

	const subscribe = useCallback(
		(event: React.FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const data = Object.fromEntries(new FormData(event.currentTarget));
			const email = ((data.email as string) || "").trim();
			if (!email || !(event.currentTarget.elements.namedItem("email") as HTMLInputElement | null)?.validity.valid) {
				setPendingEmail(email);
				setNewsletterState("invalid");
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

	const finishSubscribe = useCallback(async () => {
		if (!token) {
			setNewsletterState("error");
			return;
		}
		setNewsletterState("loading");

		try {
			const res = await subscribeToNewsletter(pendingEmail, token, firstName.trim() ? { firstName: firstName.trim() } : undefined);

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

			trackEvent("Newsletter Subscription", {
				emailType: await getEmailProvider(pendingEmail),
			});
		} catch {
			setNewsletterState("error");
		}
	}, [firstName, pendingEmail, token]);

	const renderList = useCallback(
		({ title, items }: { title: string; items: readonly { readonly name: string; readonly href: string }[] }) => (
			<div>
				<h3 className='text-sm text-foreground/75 font-semibold'>{title}</h3>
				<ul className='mt-2 space-y-0.5'>
					{items.map((item) => (
						<li key={item.name}>
							<Link className='text-foreground/75 text-sm' href={item.href}>
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
				<div className='mx-auto w-full min-w-0 max-w-7xl px-6 pt-16 pb-8 sm:pt-24 lg:px-8 lg:pt-32'>
					<div className='xl:grid xl:grid-cols-3 xl:gap-8'>
						<div className='space-y-6 md:pr-8'>
							<div className='flex items-center justify-start'>
								<Logo size={34} />
								<span className='text-sm font-medium'>Clipify</span>
							</div>
							<div className='space-y-4'>
								<p className='text-sm text-foreground/75'>Need a break? Clipify got you covered. Auto-play clips while you are away - keep your stream alive and your viewers entertained.</p>
								{communityStreamers.length > 0 ? (
									<Link href='/community' className='inline-flex max-w-fit flex-col items-start gap-2 rounded-[14px] border border-default/80 bg-surface-secondary/70 px-3 py-2 transition hover:border-default hover:bg-surface-secondary'>
										<div className='space-y-0.5 text-left'>
											<p className='text-sm font-semibold text-foreground'>Clipify community</p>
											<p className='text-[11px] text-foreground/75'>
												{communityStreamerCount} streamer{communityStreamerCount === 1 ? "" : "s"}
											</p>
										</div>
										<CommunityTeaser streamers={communityStreamers} totalCount={communityStreamerCount} countClassName='ml-2 text-[11px] font-medium text-foreground/75' />
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
									<button type='button' className='link mt-1 text-sm text-foreground/75' onClick={() => window.dispatchEvent(new CustomEvent(OPEN_CONSENT_PREFERENCES_EVENT))}>
										Cookie preferences
									</button>
								</div>
							</div>
						</div>
					</div>

					<Card variant='secondary' className='mt-4 mb-10 sm:mt-6 sm:mb-14 lg:mt-8 lg:mb-16'>
						<Card.Content className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
							<div className='shrink-0'>
								<h3 className='text-sm text-foreground/75 font-semibold'>Subscribe to our newsletter</h3>
								<p className='text-sm text-foreground/75 mt-2'>Receive updates on new features, tips and tricks, or offers straight to your email.</p>
							</div>
							<div className='w-full lg:max-w-md'>
								<Form className='w-full space-y-2' validationBehavior='aria' onSubmit={subscribe}>
									<div ref={emailStepRef}>
										<TextField aria-label='Newsletter email address' fullWidth isRequired type='email' name='email' validationBehavior='aria' isInvalid={newsletterState === "invalid"} isDisabled={newsletterState === "loading" || newsletterState === "success"}>
											<InputGroup fullWidth variant='secondary'>
												<InputGroup.Prefix>
													{(() => {
														switch (newsletterState) {
															case "loading":
																return <Spinner />;
															case "success":
																return <IconCircleCheckFilled className='text-success' />;
															default:
																return <IconMailFilled className='text-foreground/75' />;
														}
													})()}
												</InputGroup.Prefix>
												<InputGroup.Input
													className='min-w-0'
													placeholder='mail@example.com'
													onChange={() => {
														setNewsletterState("default");
													}}
												/>
												<InputGroup.Suffix className='pl-2 pr-1'>
													{
														<Button className='rounded-md' size='sm' isIconOnly type='submit' isDisabled={emailSubmitDisabled} aria-label='Continue newsletter signup' variant='primary'>
															<IconSend className='text-white' />
														</Button>
													}
												</InputGroup.Suffix>
											</InputGroup>
											<div className='min-h-6 pt-1 text-xs' aria-live='polite'>
												{newsletterState === "invalid" && <FieldError>Enter a valid email address.</FieldError>}
												{newsletterState === "captcha" && <p>Please complete verification.</p>}
											</div>
										</TextField>
									</div>
									{!isE2ETestMode && (
										<div className={formWidth > 0 && formWidth < 300 ? "min-h-[140px]" : "min-h-[65px]"}>
											{formWidth > 0 && (
												<Turnstile
													theme={resolvedTheme === "dark" ? "dark" : "light"}
													size={formWidth < 300 ? "compact" : "flexible"}
													appearance='always'
													siteKey='0x4AAAAAACMFR636JljxhVLl'
													onSuccess={setToken}
													onError={(error) => {
														setToken(null);
														console.error("Turnstile error:", error);
													}}
													onExpire={() => setToken(null)}
												/>
											)}
										</div>
									)}
								</Form>
							</div>
						</Card.Content>
					</Card>
					<Modal.Backdrop
						isOpen={isDetailsExpanded}
						onOpenChange={(open) => {
							if (newsletterState !== "loading") setIsDetailsExpanded(open);
						}}
					>
						<Modal.Container size='sm'>
							<Modal.Dialog>
								<Modal.CloseTrigger aria-label='Cancel newsletter signup' />
								<Modal.Header>
									<Modal.Heading>Subscribe to our newsletter</Modal.Heading>
								</Modal.Header>
								<Modal.Body>
									<p className='text-sm text-foreground/75'>We’ll send a confirmation email to {pendingEmail}.</p>
									<Form
										className='mt-4 space-y-4'
										validationBehavior='aria'
										onSubmit={(event) => {
											event.preventDefault();
											void finishSubscribe();
										}}
									>
										<TextField fullWidth>
											<Label>First name (optional)</Label>
											<Input autoFocus fullWidth variant='secondary' placeholder={firstNamePlaceholder} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
										</TextField>
										<div className='min-h-5 text-sm text-danger' role='alert'>
											{newsletterState === "error" ? "Could not subscribe right now. Please try again." : newsletterState === "rateLimit" ? "Too many attempts. Please wait a moment." : null}
										</div>
										<Button type='submit' fullWidth variant='primary' isPending={newsletterState === "loading"} isDisabled={detailSubmitDisabled}>
											Subscribe
										</Button>
									</Form>
								</Modal.Body>
							</Modal.Dialog>
						</Modal.Container>
					</Modal.Backdrop>
					<Modal.Backdrop isOpen={isSuccessOpen} onOpenChange={setIsSuccessOpen}>
						<Modal.Container>
							<Modal.Dialog>
								<Modal.CloseTrigger aria-label='Close newsletter confirmation' />
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

					<div className='flex flex-wrap justify-between gap-2 pt-8'>
						<div>
							<div className='flex items-center justify-center gap-3 md:justify-start'>
								<Link href='https://status.thedannicraft.de/status/clipify' className='text-foreground/75'>
									<span className='inline-flex items-center gap-2 text-xs font-medium'>
										<span aria-hidden className='h-2 w-2 rounded-full' style={{ backgroundColor: statusColor }} />
										<span>{statusText}</span>
									</span>
								</Link>
							</div>
							<p className='text-center text-xs text-foreground/75 md:text-start'>&copy; {new Date().getFullYear()} TheDanniCraft. All rights reserved.</p>
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
