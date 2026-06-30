"use client";

import { useState } from "react";
import { Button, Form, Input, Link, Popover, RadioGroup, Spinner, Tab, Tabs, Textarea, TextField, Label, FieldError } from "@heroui/react";
import Image from "next/image";

import { IconChevronLeft, IconX } from "@tabler/icons-react";
import { FiderPost, submitFeedback } from "@actions/feedbackWidget";
import { RatingValueEnum } from "@types";
import FeedbackRatingItem from "./itemRating";
import { RateLimitError } from "@types";
import { isRatelimitError } from "@actions/rateLimit";

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
				<Popover isOpen={open} onOpenChange={setOpen}>
					<Popover.Trigger>
						<Button onPress={() => {
								setOpen(true);
								setState("default");
							}} className='fixed top-1/2 right-0 z-50 -translate-y-1/2 rounded-b-[0] shadow-lg text-xs rotate-[-90deg] origin-bottom-right'>
							Feedback
						</Button>
					</Popover.Trigger>

					<Popover.Content placement='left' offset={-40} className='h-screen w-screen rounded-r-[0] p-5 sm:m-0 sm:h-full sm:w-full'>
						<Popover.Dialog>
						<div>
							<div className='flex justify-between mb-3'>
								<Button size='sm' isIconOnly variant='tertiary' onPress={() => setState("default")} className={`${state === "default" || state === "loading" ? "invisible" : "visible"}`}>{<IconChevronLeft />}</Button>
								<Button size='sm' isIconOnly variant='tertiary' onPress={() => setOpen(false)}>{<IconX />}</Button>
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
											<TextField name='title' fullWidth isRequired><Label>Title</Label><Input placeholder='' minLength={10} maxLength={32} className='h-8 text-sm' /><FieldError /></TextField>
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
											<Button type='submit' className='w-full'>
												Submit {type === "feedback" ? "Feedback" : type === "bug" ? "Bug Report" : "Feature Request"}
											</Button>
										</Form>
									)}
									{state === "loading" && (
										<div className='flex flex-col items-center justify-center py-8'>
											<Spinner size='lg' color='accent' className='animate-pulse' />
											<span>Submitting feedback...</span>
										</div>
									)}
									{state === "success" && (
										<div className='flex flex-col items-center justify-center py-4'>
											<Image unoptimized src='https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Activities/Party%20Popper.png' alt='Success Image' width={64} height={64} className='pb-4' />
											<p>Thank you for your {type === "feedback" ? "feedback" : type === "bug" ? "bug report" : "feature request"}!</p>
											{response && "html_url" in response && (
												<Link href={response.html_url} className='mb-5 underline underline-offset-2 text-sm' target='_blank' rel='noopener noreferrer'>
													Open feedback
													<Link.Icon />
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
						</Popover.Dialog>
					</Popover.Content>
				</Popover>
			</div>
		</>
	);
}
