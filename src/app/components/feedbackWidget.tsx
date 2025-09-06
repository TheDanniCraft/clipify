"use client";

import { useState } from "react";
import { Button, Form, Image, Input, Link, Popover, PopoverContent, PopoverTrigger, RadioGroup, Spinner, Tab, Tabs, Textarea } from "@heroui/react";
import { IconChevronLeft, IconX } from "@tabler/icons-react";
import { FiderPost, submitFeedback } from "../actions/feedbackWidget";
import FeedbackRatingItem, { RatingValueEnum } from "./feedback/itemRating";
import { RateLimitError } from "../lib/types";
import { isRatelimitError } from "../actions/rateLimit";

export default function FeedbackWidget() {
	const [open, setOpen] = useState(false);
	const [type, setType] = useState<"feedback" | "feature" | "bug">("feedback");
	const [state, setState] = useState<"default" | "loading" | "success" | "error" | "ratelimit">("default");
	const [response, setResponse] = useState<FiderPost | RateLimitError | null>();

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);

		await setState("loading");

		const title = formData.get("title") as string;
		const comment = formData.get("comment") as string | undefined;
		const ratingRaw = formData.get("rating");
		const rating = ratingRaw !== null ? (ratingRaw as RatingValueEnum) : undefined;

		try {
			const response = await submitFeedback({
				type,
				feedback: {
					title,
					comment,
					rating,
				},
			});

			setState("success");
			setResponse(response);
		} catch (error) {
			console.error("Error submitting feedback:", error);
			setState("error");

			if (await isRatelimitError(error)) {
				setState("ratelimit");
			}

			return;
		}
	};

	return (
		<>
			<div className='fixed bottom-6 right-6 z-50'>
				<Popover isOpen={open} onOpenChange={setOpen} placement='left' offset={-40} shouldBlockScroll>
					<PopoverTrigger>
						<Button
							onPress={() => {
								setOpen(true);
								setState("default");
							}}
							className='fixed top-1/2 right-0 z-50 -translate-y-1/2 rounded-b-[0] shadow-lg text-xs rotate-[-90deg] origin-bottom-right'
						>
							Feedback
						</Button>
					</PopoverTrigger>

					<PopoverContent className='p-5 rounded-r-[0] h-screen w-screen sm:h-full sm:m-0 sm:w-full'>
						<div>
							<div className='flex justify-between mb-3'>
								<Button size='sm' isIconOnly startContent={<IconChevronLeft />} variant='light' onPress={() => setState("default")} className={`${state === "default" || state === "loading" ? "invisible" : "visible"}`} />
								<Button size='sm' isIconOnly startContent={<IconX />} variant='light' onPress={() => setOpen(false)} />
							</div>
							<div className='sm:max-h-[400px] overflow-scroll'>
								<p className='text-xl font-bold'>Send us your feedback</p>
								<p className='font-bold'>What would you like to do?</p>
								<div>
									{state === "default" && (
										<Form onSubmit={handleSubmit} className='mt-4'>
											<Tabs selectedKey={type} onSelectionChange={(key) => setType(key as "feedback" | "feature" | "bug")}>
												<Tab title='💬 Feedback' key='feedback' className='w-full' />
												<Tab title='🆕 Feature' key='feature' />
												<Tab title='🐞 Bug' key='bug' />
											</Tabs>
											<Input size='sm' name='title' fullWidth label='Title' placeholder='' isRequired minLength={10} maxLength={32} />
											<Textarea name='comment' fullWidth placeholder="I like... / I don't like" minRows={6} maxRows={6} />
											{type === "feedback" && (
												<div className='flex justify-between text-2xl w-full'>
													<RadioGroup name='rating' orientation='horizontal' className='w-full'>
														<div className='w-full flex justify-center'>
															<FeedbackRatingItem value={RatingValueEnum.BAD} />
															<FeedbackRatingItem value={RatingValueEnum.POOR} />
															<FeedbackRatingItem value={RatingValueEnum.NEUTRAL} />
															<FeedbackRatingItem value={RatingValueEnum.GREAT} />
															<FeedbackRatingItem value={RatingValueEnum.EXCELLENT} />
														</div>
													</RadioGroup>
												</div>
											)}
											<Button fullWidth type='submit'>
												Submit Feedback
											</Button>
										</Form>
									)}
									{state === "loading" && (
										<div className='flex flex-col items-center justify-center py-8'>
											<Spinner size='lg' color='primary' label='Submitting feedback...' className='animate-pulse' />
										</div>
									)}
									{state === "success" && (
										<div className='flex flex-col items-center justify-center py-4'>
											<Image src='https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Activities/Party%20Popper.png' alt='Success Image' width={64} className='pb-4' />
											<p>Thank you for your {type === "feedback" ? "feedback" : type === "bug" ? "bug report" : "feature request"}!</p>
											{response && "html_url" in response && (
												<Link isExternal showAnchorIcon underline='always' href={response.html_url} size='sm' className='mb-5'>
													Open feedback
												</Link>
											)}
										</div>
									)}
									{state === "error" && (
										<div className='flex flex-col items-center justify-center py-4'>
											<div className='text-red-500 font-semibold flex flex-col items-center'>
												<p>An error occurred while submitting your feedback.</p>
												<p>Please wait a moment and try again.</p>
											</div>
										</div>
									)}
									{state === "ratelimit" && (
										<div className='flex flex-col items-center justify-center py-4'>
											<div className='text-red-500 font-semibold flex flex-col items-center'>
												<p>You are submitting feedback too quickly.</p>
												<p>Please wait a moment and try again.</p>
											</div>
										</div>
									)}
								</div>
							</div>
						</div>
					</PopoverContent>
				</Popover>
			</div>
		</>
	);
}
