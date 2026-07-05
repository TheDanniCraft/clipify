"use client";
import { Cta, Timer } from "@types";

import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Button, Form, Popover, Spinner, TextField, Label, Description, FieldError, InputGroup } from "@heroui/react";
import Image from "next/image";

import { IconCircleCheckFilled, IconMailFilled, IconSend } from "@tabler/icons-react";
import { subscribeToNewsletter, getEmailProvider } from "@actions/newsletter";
import { usePlausible } from "next-plausible";
import { isRatelimitError } from "@actions/rateLimit";
import { Turnstile } from "nextjs-turnstile";

const Construction = ({ endDate, cta }: { endDate?: Date; cta: Cta }) => {
	const plausible = usePlausible();
	const [token, setToken] = useState<string | null>(null);
	const [timeLeft, setTimeLeft] = useState({
		days: "0",
		hours: "0",
		minutes: "0",
		seconds: "0",
	} as Timer);
	const [newsletterState, setNewsletterState] = useState("default");

	useEffect(() => {
		if (!endDate) return;

		const calculateTimeLeft = () => {
			const difference = new Date(endDate).getTime() - new Date().getTime();
			if (difference > 0) {
				const days = Math.floor(difference / (1000 * 60 * 60 * 24));
				const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
				const minutes = Math.floor((difference / 1000 / 60) % 60);
				const seconds = Math.floor((difference / 1000) % 60);
				setTimeLeft({
					days: days.toString(),
					hours: hours.toString().padStart(2, "0"),
					minutes: minutes.toString().padStart(2, "0"),
					seconds: seconds.toString().padStart(2, "0"),
				});
			} else {
				setTimeLeft({
					days: "0",
					hours: "00",
					minutes: "00",
					seconds: "00",
				});
			}
		};

		const timer = setInterval(calculateTimeLeft, 1000);
		calculateTimeLeft(); // Initial call to set the state immediately
		return () => clearInterval(timer);
	}, [endDate]);

	async function subscribe(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = Object.fromEntries(new FormData(event.currentTarget));
		await setNewsletterState("loading");

		await subscribeToNewsletter(data.email as string, token || "")
			.then(async (res) => {
				if (await isRatelimitError(res)) {
					setNewsletterState("rateLimit");
					return;
				}
				setNewsletterState("success");
				plausible("Newsletter Subscription", {
					props: {
						emailType: await getEmailProvider(data.email as string),
					},
				});
			})
			.catch(async () => {
				await setNewsletterState("error");
			});
	}

	return (
		<div className='min-h-screen min-w-screen flex items-center justify-center bg-gradient-to-br from-brand-800 to-brand-400'>
			<div className='flex flex-col items-center'>
				<motion.h1 className='text-4xl font-bold mb-2' initial={{ opacity: 0.1, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
					COMING SOON
				</motion.h1>
				<motion.p className='text-muted text-lg mb-8' initial={{ opacity: 0.1 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.5 }}>
					This page is under construction
				</motion.p>

				{endDate && (
					<div className='flex gap-4 mb-12 justify-center'>
						{["days", "hours", "minutes", "seconds"].map((key, i) => (
							<motion.div key={key} className='bg-foreground border shadow-md px-5 py-3 rounded-lg text-center flex flex-col items-center' custom={i} initial={{ opacity: 0.1, x: 15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.2, duration: 0.1 }} style={{ width: "80px" }}>
								<motion.div
									className='text-3xl text-muted font-semibold'
									initial={{ scale: 0.8, opacity: 0.1 }}
									animate={{ scale: 1, opacity: 1 }}
									transition={{ duration: 0.5 }}
									key={timeLeft[key as keyof Timer]} // Re-trigger animation on value change
								>
									{timeLeft[key as keyof Timer]}
								</motion.div>
								<p className='text-xs text-muted lowercase'>{key}</p>
							</motion.div>
						))}
					</div>
				)}

				<motion.div initial={{ opacity: 0.1 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 + (endDate ? 0.3 : 0), duration: 0.5 }}>
					<Popover>
						<Button variant='secondary' size='lg' aria-label={cta.text}>
							{cta.icon}
							{cta.text}
						</Button>
						<Popover.Content offset={10} placement='bottom' className='w-[300px] min-w-[300px] p-5'>
							<Popover.Arrow />
							<Popover.Dialog>
								<Form onSubmit={subscribe}>
									<TextField isRequired type='email' className={newsletterState == "success" ? "text-success" : newsletterState == "error" || newsletterState == "rateLimit" ? "text-danger" : "text-foreground"} name='email' isDisabled={newsletterState === "loading" || newsletterState === "success"}>
										<Label>Enter your Email</Label>
										<InputGroup>
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
													<Button size='sm' isIconOnly type='submit' isDisabled={newsletterState === "loading" || newsletterState === "success"} aria-label='Subscribe to newsletter' variant='primary'>
														<IconSend className='text-white' />
													</Button>
												}
											</InputGroup.Suffix>
										</InputGroup>
										<Description>
											{(() => {
												switch (newsletterState) {
													case "loading":
														return "Subscribing...";
													case "error":
														return "An error occurred. Please try again. If the error persists, please contact the team.";
													case "rateLimit":
														return "Please wait before trying again.";
													default:
														return "";
												}
											})()}
										</Description>
										<FieldError />
									</TextField>
									<Turnstile siteKey='0x4AAAAAACMFR636JljxhVLl' onSuccess={setToken} onError={() => console.error("Turnstile error")} onExpire={() => setToken(null)} />
								</Form>
								{newsletterState === "success" && (
									<div className='text-success mt-2 text-center'>
										<Image unoptimized alt='Tada Icon' src='https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Activities/Party%20Popper.png' width={50} height={50} className='mx-auto' />
										<p className='text-lg font-bold'>You&apos;re almost there!</p>
										<p className='text-xs'>We&apos;ve just sent a confirmation email your way. Check your inbox to finish subscribing-and if you don&apos;t see it, be sure to take a quick look in your spam folder too.</p>
									</div>
								)}
							</Popover.Dialog>
						</Popover.Content>
					</Popover>
				</motion.div>

				<motion.footer className='mt-5 text-sm text-muted' initial={{ opacity: 0.1 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 + (endDate ? 0.3 : 0), duration: 0.5 }}>
					© {new Date().getFullYear()} Clipify. Made by TheDanniCraft
				</motion.footer>
			</div>
		</div>
	);
};

export default Construction;
