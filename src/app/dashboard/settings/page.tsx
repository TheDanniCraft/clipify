"use client";

import { validateAuth } from "@/app/actions/auth";
import { deleteUser, getSettings, saveSettings } from "@/app/actions/database";
import ConfirmModal from "@/app/components/confirmModal";
import DashboardNavbar from "@/app/components/dashboardNavbar";
import { AuthenticatedUser, Plan, UserSettings } from "@/app/lib/types";
import { addToast, Avatar, Button, Card, CardBody, CardHeader, Divider, Form, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Snippet, Spinner, Tooltip, useDisclosure } from "@heroui/react";
import { IconAlertTriangle, IconArrowLeft, IconCreditCardFilled, IconCrown, IconDeviceFloppy, IconDiamondFilled, IconInfoCircle, IconTrash } from "@tabler/icons-react";
import { redirect, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { generatePaymentLink, checkIfSubscriptionExists, getPortalLink } from "@/app/actions/subscription";
import { useNavigationGuard } from "next-navigation-guard";
import { tiers } from "@/app/components/Pricing/pricing-tiers";
import { TiersEnum } from "@/app/components/Pricing/pricing-types";
import { IconCheck } from "@tabler/icons-react";
import TagsInput from "@/app/components/tagsInput";

export default function SettingsPage() {
	const [user, setUser] = useState<AuthenticatedUser | null>(null);
	const { isOpen: upgradeModalIsOpen, onOpen: upgradeModalOnOpen, onOpenChange: upgradeModalOnOpenChange } = useDisclosure();
	const { isOpen: deleteModalIsOpen, onOpen: deleteModalOnOpen, onOpenChange: deleteModalOnOpenChange } = useDisclosure();
	const [timer, setTimer] = useState<number>(0);
	const [settings, setSettings] = useState<UserSettings | null>(null);
	const [baseSettings, setBaseSettings] = useState<UserSettings | null>(null);

	// compute pro/free tier features for the upgrade modal
	const proTier = tiers.find((t) => t.key === TiersEnum.Pro);
	const freeTier = tiers.find((t) => t.key === TiersEnum.Free);
	const proFeatures = proTier?.features ?? [];
	const uniqueProFeatures = proFeatures.filter((f) => !(freeTier?.features ?? []).includes(f) && f !== "Everything in Free");

	const router = useRouter();
	const navGuard = useNavigationGuard({ enabled: isFormDirty() });

	useEffect(() => {
		async function validateUser() {
			const user = await validateAuth();
			if (!user) {
				redirect("/logout");
			}

			setUser(user);
		}

		validateUser();
	}, []);

	useEffect(() => {
		if (timer > 0) {
			const interval = setInterval(() => {
				setTimer((prev) => prev - 1);
			}, 1000);
			return () => clearInterval(interval);
		}
	}, [timer]);

	useEffect(() => {
		async function fetchSettings() {
			if (!user) return;
			const fetchedSettings = await getSettings(user.id);
			setSettings(fetchedSettings);
			setBaseSettings(fetchedSettings);
		}

		fetchSettings();
	}, [user]);

	if (!user) {
		return (
			<div className='flex items-center justify-center h-screen w-full'>
				<Spinner label='Loading' />
			</div>
		);
	}

	function isFormDirty() {
		return JSON.stringify(settings) !== JSON.stringify(baseSettings);
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		try {
			event.preventDefault();
			addToast({
				title: "Saving...",
				color: "default",
			});

			if (!settings) return;
			await saveSettings(settings);
			setBaseSettings(settings);
			addToast({
				title: "Settings saved",
				description: "Your settings have been saved successfully.",
				color: "success",
			});
		} catch {
			addToast({
				title: "Error",
				description: "An error occurred while saving your settings. Please try again.",
				color: "danger",
			});
		}
	}

	return (
		<>
			<script src='//tag.goadopt.io/injector.js?website_code=792b9b29-57f9-4d92-b5f1-313f94ddfacc' className='adopt-injector' defer></script>

			<DashboardNavbar user={user} title='Settings' tagline='Manage your settings'>
				<Card className='mt-4'>
					<CardHeader>
						<div className='flex items-center gap-2 w-full justify-between'>
							<Button isIconOnly variant='light' startContent={<IconArrowLeft />} onPress={() => router.push("/dashboard")} aria-label='Back to Dashboard' />
							<div className='flex items-center gap-2'>
								<div className='flex items-center overflow-hidden'>
									<Snippet
										size='sm'
										symbol='User ID:'
										classNames={{
											pre: "overflow-hidden whitespace-nowrap",
										}}
									>
										{user.id}
									</Snippet>
								</div>
								<Tooltip content='If you contact support, please specify this user ID.'>
									<IconInfoCircle size={20} className='text-default-400' />
								</Tooltip>
							</div>
						</div>
					</CardHeader>
					<CardBody className='pl-4 pr-4 pt-0'>
						<div className='flex items-center mb-4'>
							<Avatar src={user.avatar} size='lg' className='mr-4' />
							<div>
								<p className='text-2xl font-bold'>{user.username}</p>
								<p className='text-sm font-bold text-muted-foreground'>
									<span className='text-muted-foreground'>Plan:</span> <span className={`${user.plan === Plan.Free ? "text-green-600" : "text-primary-400"} capitalize`}>{user.plan}</span>
								</p>
							</div>
						</div>
						{user.plan === Plan.Free && (
							<Button color='primary' startContent={<IconDiamondFilled />} isDisabled={user.plan != Plan.Free} onPress={upgradeModalOnOpen} aria-label='Upgrade Account'>
								Upgrade Account
							</Button>
						)}
						{user.plan !== Plan.Free && (
							<Button
								color='primary'
								startContent={<IconCreditCardFilled />}
								onPress={async () => {
									const link = await getPortalLink(user);
									if (link) {
										window.location.href = link;
									} else {
										addToast({
											title: "Error",
											description: "Failed to generate portal link. Please try again later.",
											color: "danger",
										});
									}
								}}
							>
								Manage Subscription
							</Button>
						)}
						<Divider className='my-4' />

						<Form className='w-full' onSubmit={handleSubmit}>
							<Input
								label='Command Prefix'
								type='text'
								value={settings?.prefix || ""}
								description='Maximum of 3 characters. This prefix will be used for all bot commands.'
								maxLength={3}
								onChange={(e) => {
									const value = e.target.value.trim();
									if (value.length <= 3) {
										setSettings({ ...settings!, prefix: value });
									}
								}}
								required
							/>

							{user.plan === Plan.Free && (
								<div className='w-full mb-4'>
									<Card className='bg-warning-50 border border-warning-200 mb-2'>
										<CardBody>
											<div className='flex items-center gap-2 mb-1'>
												<IconCrown className='text-warning-500' />
												<span className='text-warning-800 font-semibold text-base'>Premium Feature Locked</span>
											</div>
											<p className='text-sm text-warning-700'>
												Unlock advanced settings with <span className='font-semibold'>Premium</span>.
											</p>
											<ul className='list-disc list-inside text-warning-700 text-xs mt-2 ml-1'>
												<li>Grant editors permission to manage your overlays</li>
												<li>Priority support</li>
											</ul>
											<Button
												color='warning'
												variant='shadow'
												onPress={async () => {
													if (!user) return;

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
											<p className='text-xs text-warning-600 text-center mt-2'>Enjoy a 3-day free trial. Cancel anytime.</p>
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
								<TagsInput
									fullWidth
									maxInputs={5}
									label='Edit editors'
									description={"Twitch usernames of users you want to grant permission to manage your overlays. Editors can modify, create and delete overlays on your behalf."}
									value={settings?.editors}
									validate={(value) => {
										for (const name of value) {
											if (!/^[A-Za-z0-9_]{4,25}$/.test(name)) {
												return `Invalid Twitch username: '${name}' (use 4–25 chars, only letters/numbers/_)`;
											}

											if (name.toLowerCase() === user.username.toLowerCase()) {
												return `You cannot add yourself as an editor.`;
											}
										}
										return null;
									}}
									onValueChange={(editors) => {
										setSettings({ ...settings!, editors });
									}}
								/>
							</div>

							<Button type='submit' color='primary' className='mt-4' fullWidth isDisabled={!isFormDirty()} aria-label='Save Settings' startContent={<IconDeviceFloppy />}>
								Save Settings
							</Button>
						</Form>
						<Divider className='my-4' />
						<div className='flex  flex-col gap-2 justify-end'>
							<Button
								color='danger'
								startContent={<IconTrash />}
								isDisabled={user.plan !== Plan.Free}
								onPress={async () => {
									if (await checkIfSubscriptionExists(user)) {
										return addToast({
											title: "Active Subscription",
											description: "You have an active subscription. Please cancel it before deleting your account.",
											color: "danger",
										});
									}
									deleteModalOnOpen();
								}}
							>
								Delete Account
							</Button>
							{user.plan !== Plan.Free && <span className='text-sm text-gray-500'>You must cancel your subscription and wait for it to expire before deleting your account.</span>}
						</div>
					</CardBody>
				</Card>
			</DashboardNavbar>

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
							You&apos;ve made changes to your <span className='font-semibold text-default-900'> settings</span> that haven&apos;t been saved. If you go back now, <span className='font-semibold text-danger'>those changes will be lost</span>.
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

			<Modal isOpen={upgradeModalIsOpen} onOpenChange={upgradeModalOnOpenChange}>
				<ModalContent>
					<ModalHeader>Upgrade Account</ModalHeader>
					<ModalBody>
						<p className='text-muted-foreground'>Upgrade your account to unlock advanced features and support the development of Clipify. Your support helps us keep improving the service.</p>
						<p>
							Plan: <span className={`${user.plan === Plan.Free ? "text-green-600" : "text-primary-400"} capitalize`}>{user.plan}</span>
						</p>

						<Divider />

						{/* Feature list: show Pro features and emphasize upgrade-only items */}
						{proTier && (
							<>
								<p className='mt-3 text-default-700'>What&apos;s included with Pro</p>
								<ul className='grid grid-cols-1 gap-1 sm:grid-cols-2 mt-1 text-sm'>
									{proFeatures.map((f) => {
										const isUnique = uniqueProFeatures.includes(f);
										return (
											<li key={f} className='flex items-start gap-2'>
												<IconCheck size={16} className={isUnique ? "text-primary mt-0.5" : "text-default-400 mt-0.5"} />
												<p className={isUnique ? "text-default-900 font-medium" : "text-default-500"}>{f}</p>
											</li>
										);
									})}
								</ul>
							</>
						)}

						<Divider className='my-3' />
						<Button
							className='mb-2'
							color='primary'
							onPress={async () => {
								const link = await generatePaymentLink(user, window.location.href, window.numok.getStripeMetadata());

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
							startContent={<IconDiamondFilled />}
							isDisabled={user.plan !== Plan.Free}
						>
							Upgrade to Pro
						</Button>
					</ModalBody>
				</ModalContent>
			</Modal>

			<ConfirmModal
				isOpen={deleteModalIsOpen}
				onOpenChange={deleteModalOnOpenChange}
				keyword={user.username}
				onConfirm={async () => {
					addToast({
						title: "Deleting...",
						description: "Your account is being deleted. You will be redirected soon.",
						color: "danger",
					});

					await deleteUser(user.id);
					router.push("/logout");
				}}
			/>
		</>
	);
}
