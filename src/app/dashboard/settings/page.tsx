"use client";

import { validateAuth } from "@/app/actions/auth";
import { deleteUser, getSettings, saveSettings } from "@/app/actions/database";
import ConfirmModal from "@/app/components/confirmModal";
import DashboardNavbar from "@/app/components/dashboardNavbar";
import { AuthenticatedUser, Plan, UserSettings } from "@/app/lib/types";
import { addToast, Avatar, Button, Card, CardBody, CardHeader, Divider, Form, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Snippet, Spinner, Tooltip, useDisclosure } from "@heroui/react";
import { IconAlertTriangle, IconArrowLeft, IconCreditCardFilled, IconDeviceFloppy, IconDiamondFilled, IconInfoCircle, IconTrash } from "@tabler/icons-react";
import { redirect, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { generatePaymentLink, checkIfSubscriptionExists, getPortalLink } from "@/app/actions/subscription";
import { useNavigationGuard } from "next-navigation-guard";

export default function SettingsPage() {
	const [user, setUser] = useState<AuthenticatedUser | null>(null);
	const { isOpen: upgradeModalIsOpen, onOpen: upgradeModalOnOpen, onOpenChange: upgradeModalOnOpenChange } = useDisclosure();
	const { isOpen: deleteModalIsOpen, onOpen: deleteModalOnOpen, onOpenChange: deleteModalOnOpenChange } = useDisclosure();
	const [timer, setTimer] = useState<number>(0);
	const [settings, setSettings] = useState<UserSettings | null>(null);
	const [baseSettings, setBaseSettings] = useState<UserSettings | null>(null);

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

			console.log("Fetched settings:", fetchedSettings, user);
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
		event.preventDefault();
		addToast({
			title: "Saving...",
			color: "default",
		});

		console.log("Submitting settings:", settings);

		if (!settings) return;
		await saveSettings(settings);
		setBaseSettings(settings);
		addToast({
			title: "Settings saved",
			description: "Your settings have been saved successfully.",
			color: "success",
		});
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
						<Button
							className='mb-2'
							color='primary'
							onPress={async () => {
								const link = await generatePaymentLink(user);

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
