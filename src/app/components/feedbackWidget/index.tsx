"use client";

import { useState } from "react";
import { Button, Form, Input, Link, LinkIcon, Popover, RadioGroup, Spinner, Tabs, TextArea, TextField, Label, FieldError } from "@heroui/react";
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
			<div className='fixed right-0 top-1/2 z-50 -translate-y-1/2'>
				<Popover isOpen={open} onOpenChange={setOpen}>
					<Button
						variant='tertiary'
						onPress={() => {
							setOpen(true);
							setState("default");
						}}
						className='rounded-b-none text-xs shadow-lg rotate-[-90deg] origin-bottom-right'
					>
						Feedback
					</Button>

					<Popover.Content placement='left' offset={-40} className='w-[min(22rem,100vw)] rounded-r-none'>
						<Popover.Dialog>
							<div className='min-w-0'>
								<div className='mb-3 flex justify-between'>
									<Button size='sm' isIconOnly variant='tertiary' onPress={() => setState("default")} className={`${state === "default" || state === "loading" ? "invisible" : "visible"}`}>
										{<IconChevronLeft />}
									</Button>
									<Button size='sm' isIconOnly variant='tertiary' onPress={() => setOpen(false)}>
										{<IconX />}
									</Button>
								</div>
								<div className='max-h-[min(32rem,calc(100vh-7rem))] overflow-y-auto px-1 pb-1'>
									<p className='text-xl font-bold'>Send us your feedback</p>
									<p className='font-bold'>What would you like to do?</p>
									<div>
										{state === "default" && (
											<Form onSubmit={handleSubmit} className='mt-4 flex w-full flex-col gap-4'>
												<Tabs className='w-full' selectedKey={type} onSelectionChange={(key) => setType(key as "feedback" | "feature" | "bug")}>
													<Tabs.ListContainer className='w-full'>
														<Tabs.List className='w-full whitespace-nowrap' aria-label='Feedback type'>
															<Tabs.Tab id='feedback'>
																💬 Feedback
																<Tabs.Indicator />
															</Tabs.Tab>
															<Tabs.Tab id='feature'>
																🆕 Feature
																<Tabs.Indicator />
															</Tabs.Tab>
															<Tabs.Tab id='bug'>
																🐞 Bug
																<Tabs.Indicator />
															</Tabs.Tab>
														</Tabs.List>
													</Tabs.ListContainer>
												</Tabs>
												<TextField name='title' fullWidth variant='secondary' isRequired>
													<Label>Title</Label>
													<Input className='w-full' placeholder='' minLength={10} maxLength={32} />
													<FieldError />
												</TextField>
												<TextField fullWidth variant='secondary' name='comment'>
													<Label>Comment</Label>
													<TextArea className='w-full resize-none' placeholder="I like... / I don't like" rows={6} />
												</TextField>
												{type === "feedback" && (
													<div className='flex w-full justify-between'>
														<RadioGroup name='rating' orientation='horizontal' className='w-full'>
															<div className='flex w-full justify-between gap-1'>
																<FeedbackRatingItem fullWidth value={RatingValueEnum.BAD} />
																<FeedbackRatingItem fullWidth value={RatingValueEnum.POOR} />
																<FeedbackRatingItem fullWidth value={RatingValueEnum.NEUTRAL} />
																<FeedbackRatingItem fullWidth value={RatingValueEnum.GREAT} />
																<FeedbackRatingItem fullWidth value={RatingValueEnum.EXCELLENT} />
															</div>
														</RadioGroup>
													</div>
												)}
												<Button fullWidth variant='primary' type='submit'>
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
														<LinkIcon />
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
