"use client";
import { Cta, Timer } from "@types";

import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Button, Form, Image, Input, Popover, PopoverContent, PopoverTrigger, Spinner } from "@heroui/react";
import { IconCircleCheckFilled, IconMailFilled, IconSend } from "@tabler/icons-react";
import { subscribeToNewsletter, getEmailProvider } from "@/app/actions/newsletter";
import { usePlausible } from "next-plausible";
import { isRatelimitError } from "@actions/rateLimit";

const Construction = ({ endDate, cta }: { endDate?: Date; cta: Cta }) => {
	const plausible = usePlausible();
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

		await subscribeToNewsletter(data.email as string)
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
		<div className='min-h-screen min-w-screen flex items-center justify-center bg-gradient-to-br from-primary-800 to-primary-400'>
			<div className='flex flex-col items-center'>
				<motion.h1 className='text-4xl font-bold mb-2' initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
					COMING SOON
				</motion.h1>
				<motion.p className='text-default-600 text-lg mb-8' initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.5 }}>
					This page is under construction
				</motion.p>

				{endDate && (
					<div className='flex gap-4 mb-12 justify-center'>
						{["days", "hours", "minutes", "seconds"].map((key, i) => (
							<motion.div key={key} className='bg-foreground border shadow-md px-5 py-3 rounded-lg text-center flex flex-col items-center' custom={i} initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.2, duration: 0.1 }} style={{ width: "80px" }}>
								<motion.div
									className='text-3xl text-default-200 font-semibold'
									initial={{ scale: 0.8, opacity: 0 }}
									animate={{ scale: 1, opacity: 1 }}
									transition={{ duration: 0.5 }}
									key={timeLeft[key as keyof Timer]} // Re-trigger animation on value change
								>
									{timeLeft[key as keyof Timer]}
								</motion.div>
								<p className='text-xs text-default-300 lowercase'>{key}</p>
							</motion.div>
						))}
					</div>
				)}

				<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 + (endDate ? 0.3 : 0), duration: 0.5 }}>
					<Popover showArrow offset={10} placement='bottom' backdrop='blur'>
						<PopoverTrigger>
							<Button variant='faded' size='lg' startContent={cta.icon}>
								{cta.text}
							</Button>
						</PopoverTrigger>
						<PopoverContent className='p-5 w-[300px] min-w-[300px]'>
							<Form onSubmit={subscribe}>
								<Input
									isRequired
									label='Enter your Email'
									placeholder='mail@example.com'
									type='email'
									labelPlacement='outside'
									className={newsletterState == "success" ? "text-success" : newsletterState == "error" || newsletterState == "rateLimit" ? "text-danger" : "text-default-900"}
									description={(() => {
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
										setNewsletterState("defult");
									}}
									name='email'
									isDisabled={newsletterState === "loading" || newsletterState === "success"}
									endContent={
										<Button color='primary' size='sm' isIconOnly type='submit' disabled={newsletterState === "loading" || newsletterState === "success"}>
											<IconSend className='text-default-foreground' />
										</Button>
									}
								/>
							</Form>
							{newsletterState === "success" && (
								<div className='text-success-500 mt-2 text-center'>
									<Image alt='Tada Icon' src='https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Activities/Party%20Popper.png' width='50' height='50' className='mx-auto' />
									<p className='text-lg font-bold'>You’re almost there!</p>
									<p className='text-xs'>We’ve just sent a confirmation email your way. Check your inbox to finish subscribing—and if you don’t see it, be sure to take a quick look in your spam folder too.</p>
								</div>
							)}
						</PopoverContent>
					</Popover>
				</motion.div>

				<motion.footer className='mt-5 text-sm text-default-500' initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 + (endDate ? 0.3 : 0), duration: 0.5 }}>
					© {new Date().getFullYear()} Clipify. Made by TheDanniCraft
				</motion.footer>
			</div>
		</div>
	);
};

export default Construction;
