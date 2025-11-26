"use client";

import { useEffect, useState } from "react";

import { useParams, useRouter } from "next/navigation";
import { getOverlay, getUser, saveOverlay } from "@/app/actions/database";
import { addToast, Button, Card, CardBody, CardHeader, Divider, Form, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Snippet, Spinner, Switch, Tooltip } from "@heroui/react";
import { AuthenticatedUser, Overlay, OverlayType, Plan, TwitchReward } from "@types";
import { IconAlertTriangle, IconArrowLeft, IconCrown, IconDeviceFloppy, IconInfoCircle, IconPlayerPauseFilled, IconPlayerPlayFilled } from "@tabler/icons-react";
import DashboardNavbar from "@components/dashboardNavbar";
import { useNavigationGuard } from "next-navigation-guard";
import { validateAuth } from "@/app/actions/auth";
import { createChannelReward, getReward, getTwitchClips, removeChannelReward } from "@/app/actions/twitch";
import { generatePaymentLink } from "@/app/actions/subscription";
import FeedbackWidget from "@components/feedbackWidget";

const overlayTypes: { key: OverlayType; label: string }[] = [
	{ key: "1", label: "Top Clips - Today" },
	{ key: "7", label: "Top Clips - Last 7 Days" },
	{ key: "30", label: "Top Clips - Last 30 Days" },
	{ key: "90", label: "Top Clips - Last 90 Days" },
	{ key: "180", label: "Top Clips - Last 180 Days" },
	{ key: "365", label: "Top Clips - Last Year" },
	{ key: "Featured", label: "Featured only" },
	{ key: "All", label: "All Clips" },
	{ key: "Queue", label: "Clip Queue" },
];

export default function OverlaySettings() {
	const router = useRouter();
	const { overlayId } = useParams() as { overlayId: string };

	const [overlay, setOverlay] = useState<Overlay | null>(null);
	const [baseOverlay, setBaseOverlay] = useState<Overlay | null>(null);
	const [baseUrl, setBaseUrl] = useState<string | null>(null);
	const [user, setUser] = useState<AuthenticatedUser>();
	const [reward, setReward] = useState<TwitchReward | null>(null);
	const [clipsPerType, setClipsPerType] = useState<Record<OverlayType, number>>({} as Record<OverlayType, number>);

	const navGuard = useNavigationGuard({ enabled: isFormDirty() });

	useEffect(() => {
		async function checkAuth() {
			if (!(await validateAuth())) {
				router.push("/logout");
				return;
			}
		}

		checkAuth();
	}, [router]);

	useEffect(() => {
		async function fetchRewardTitle() {
			if (overlay?.rewardId) {
				const reward = await getReward(overlay.ownerId, overlay.rewardId);
				setReward(reward);
			} else {
				setReward(null);
			}
		}
		fetchRewardTitle();
	}, [overlay?.rewardId, overlay?.ownerId]);

	useEffect(() => {
		setBaseUrl(window.location.origin);

		if (overlay?.ownerId) {
			getUser(overlay.ownerId).then((user) => {
				if (user) {
					setUser(user);
				}
			});
		}
	}, [overlay?.ownerId]);

	useEffect(() => {
		async function fetchOverlay() {
			const fetchedOverlay = await getOverlay(overlayId);
			setOverlay(fetchedOverlay);
			setBaseOverlay(fetchedOverlay);

			overlayTypes.forEach(async (type) => {
				const clips = await getTwitchClips(fetchedOverlay, type.key);

				setClipsPerType((prev) => ({ ...prev, [type.key]: clips.length }));
			});
		}
		fetchOverlay();
	}, [overlayId]);

	if (!overlayId || !overlay || !overlayTypes.every((t) => typeof clipsPerType[t.key] === "number")) {
		return (
			<div className='flex flex-col items-center justify-center w-full h-screen'>
				<Spinner label='Loading overlay' />
			</div>
		);
	}

	function isFormDirty() {
		return JSON.stringify(overlay) !== JSON.stringify(baseOverlay);
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		addToast({
			title: "Saving...",
			color: "default",
		});

		if (!overlay) return;
		await saveOverlay(overlay);
		setBaseOverlay(overlay);
		addToast({
			title: "Overlay settings saved",
			description: "Your overlay settings have been saved successfully.",
			color: "success",
		});
	}

	return (
		<>
			<script src='//tag.goadopt.io/injector.js?website_code=792b9b29-57f9-4d92-b5f1-313f94ddfacc' className='adopt-injector' defer></script>

			<DashboardNavbar user={user!} title='Overlay Settings' tagline='Manage your overlays'>
				<FeedbackWidget />

				<div className='flex flex-col items-center justify-center w-full p-4'>
					<Card className='w-full max-w-4xl'>
						<CardHeader className='justify-between space-x-1'>
							<div className='flex items-center'>
								<Button
									isIconOnly
									variant='light'
									onPress={() => {
										router.push(`${baseUrl}/dashboard`);
									}}
								>
									<IconArrowLeft />
								</Button>
								<h1 className='text-xl font-bold'>Overlay Settings</h1>
							</div>
							<span className='text-sm text-gray-500'>ID: {overlayId}</span>
						</CardHeader>
						<Divider />
						<CardBody>
							<div className='flex items-center'>
								<Form className='w-full' onSubmit={handleSubmit}>
									<div className='flex items-center w-full space-x-4'>
										<Switch
											isSelected={overlay.status == "active"}
											onValueChange={(value) => {
												setOverlay({ ...overlay, status: value ? "active" : "paused" });
											}}
											startContent={<IconPlayerPlayFilled />}
											endContent={<IconPlayerPauseFilled />}
										/>
										<div className='flex-1 overflow-hidden'>
											<Snippet
												className='w-full max-w-full'
												symbol=''
												classNames={{
													pre: "overflow-hidden whitespace-nowrap",
												}}
											>
												{`${baseUrl}/overlay/${overlayId}`}
											</Snippet>
										</div>
										<Button type='submit' color='primary' isIconOnly isDisabled={!isFormDirty()} aria-label='Save Overlay Settings'>
											<IconDeviceFloppy />
										</Button>
									</div>
									<Input
										value={overlay.name}
										onValueChange={(value) => {
											setOverlay({ ...overlay, name: value });
										}}
										isRequired
										label='Overlay Name'
									/>
									<Select
										isRequired
										selectedKeys={[overlay.type]}
										onSelectionChange={(value) => {
											setOverlay({ ...overlay, type: value.currentKey as OverlayType });
										}}
										label='Overlay Type'
									>
										{overlayTypes.map((type) => (
											<SelectItem key={type.key}>{clipsPerType[type.key] != null && type.key !== "Queue" ? `${type.label}: ${clipsPerType[type.key]}` : type.label}</SelectItem>
										))}
									</Select>
									<Divider className='my-4' />
									{user?.plan === Plan.Free && (
										<div className='w-full mb-4'>
											<Card className='bg-warning-50 border border-warning-200 mb-2'>
												<CardBody>
													<div className='flex items-center gap-2 mb-1'>
														<IconCrown className='text-warning-500' />
														<span className='text-warning-800 font-semibold text-base'>Premium Feature Locked</span>
													</div>
													<p className='text-sm text-warning-700'>
														Unlock advanced overlay settings with <span className='font-semibold'>Premium</span>.
													</p>
													<ul className='list-disc list-inside text-warning-700 text-xs mt-2 ml-1'>
														<li>Multiple overlay</li>
														<li>Link custom Twitch rewards</li>
														<li>Control your overlay via chat</li>
														<li>Priority support</li>
													</ul>
													<Button
														color='warning'
														variant='shadow'
														onPress={async () => {
															const link = await generatePaymentLink(user, window.location.href, window.numok?.getStripeMetadata());

															if (link) {
																window.location.href = link;
															} else {
																addToast({
																	title: "Error",
																	description: "Failed to generate payment link. Please try again later.",
																	color: "danger",
																});
															}
														}}
														className='mt-3 w-full font-semibold'
													>
														Upgrade for less than 2€/month
													</Button>
													<p className='text-xs text-warning-600 text-center mt-2'>Enjoy a 7-day free trial. Cancel anytime.</p>
												</CardBody>
											</Card>
										</div>
									)}
									<div
										className='w-full'
										style={{
											filter: user?.plan === Plan.Free ? "blur(1.5px)" : "none",
											pointerEvents: user?.plan === Plan.Free ? "none" : "auto",
										}}
									>
										<div className='flex w-full items-center mb-2 gap-1'>
											<Button
												onPress={async () => {
													const reward = await createChannelReward(overlay.ownerId);
													if (reward) {
														setOverlay({ ...overlay, rewardId: reward.id });
													}
												}}
												isDisabled={user?.plan === Plan.Free || !!overlay.rewardId}
											>
												Create Reward
											</Button>
											<Input
												isClearable
												onClear={() => {
													if (reward) {
														removeChannelReward(reward.id, overlay.ownerId);
													}
													setOverlay({ ...overlay, rewardId: null });
												}}
												value={reward?.title}
												placeholder='Reward ID not set'
											/>
											<Tooltip
												content={
													<div className='px-1 py-2'>
														<div className='text-tiny'>You can edit the reward through your Twitch dashboard.</div>
													</div>
												}
											>
												<IconInfoCircle className='text-default-400' />
											</Tooltip>
										</div>
									</div>
								</Form>
							</div>
						</CardBody>
					</Card>
				</div>

				<Modal backdrop='blur' isOpen={navGuard.active} onClose={navGuard.reject}>
					<ModalContent>
						<ModalHeader>
							<div className='flex items-center'>
								<IconAlertTriangle className='mr-2' />
								Unsaved Changes
							</div>
						</ModalHeader>
						<ModalBody>
							<p className='text-sm text-default-700'>
								You&apos;ve made changes to your <span className='font-semibold text-default-900'>overlay settings</span> that haven&apos;t been saved. If you go back now, <span className='font-semibold text-danger'>those changes will be lost</span>.
								<br />
								<br />
								<span className='font-semibold text-default-900'>Do you want to continue without saving?</span>
							</p>
						</ModalBody>
						<ModalFooter>
							<Button variant='light' onPress={navGuard.reject} aria-label='Cancel'>
								Cancel
							</Button>
							<Button color='danger' onPress={navGuard.accept} aria-label='Discard Changes'>
								Discard changes
							</Button>
						</ModalFooter>
					</ModalContent>
				</Modal>
			</DashboardNavbar>
		</>
	);
}
