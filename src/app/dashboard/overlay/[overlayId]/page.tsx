"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getOverlay, getUser, saveOverlay } from "@/app/actions/database";
import { addToast, Button, Card, CardBody, CardHeader, Divider, Form, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Snippet, Spinner, Switch } from "@heroui/react";
import { AuthenticatedUser, Overlay, OverlayType } from "@types";
import { IconAlertTriangle, IconArrowLeft, IconDeviceFloppy, IconPlayerPauseFilled, IconPlayerPlayFilled } from "@tabler/icons-react";
import DashboardNavbar from "@components/dashboardNavbar";
import { useNavigationGuard } from "next-navigation-guard";

const overlayTypes: { key: OverlayType; label: string }[] = [
	{ key: "1", label: "Top Clips - Today" },
	{ key: "7", label: "Top Clips - Last 7 Days" },
	{ key: "30", label: "Top Clips - Last 30 Days" },
	{ key: "90", label: "Top Clips - Last 90 Days" },
	{ key: "180", label: "Top Clips - Last 180 Days" },
	{ key: "365", label: "Top Clips - Last Year" },
	{ key: "Featured", label: "Featured only" },
	{ key: "All", label: "All Clips" },
];

export default function OverlaySettings() {
	const router = useRouter();
	const { overlayId } = useParams() as { overlayId: string };

	const [overlay, setOverlay] = useState<Overlay | null>(null);
	const [baseOverlay, setBaseOverlay] = useState<Overlay | null>(null);
	const [baseUrl, setBaseUrl] = useState<string | null>(null);
	const [user, setUser] = useState<AuthenticatedUser>();

	const navGuard = useNavigationGuard({ enabled: isFormDirty() });

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
		}
		fetchOverlay();
	}, [overlayId]);

	if (!overlayId || !overlay) {
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
		<DashboardNavbar user={user!}>
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
									<Button type='submit' color='primary' isIconOnly isDisabled={!isFormDirty()}>
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
										<SelectItem key={type.key}>{type.label}</SelectItem>
									))}
								</Select>
							</Form>
						</div>
					</CardBody>
				</Card>
			</div>

			<Modal backdrop='blur' isOpen={navGuard.active} onClose={navGuard.reject}>
				<ModalContent>
					<ModalHeader>
						<div className='flex items-center'>
							<IconAlertTriangle />
							Unsaved Changes
						</div>
					</ModalHeader>
					<ModalBody>
						<p className='text-sm text-default-700'>
							You’ve made changes to your <span className='font-semibold text-default-900'>overlay settings</span> that haven’t been saved. If you go back now, <span className='font-semibold text-danger'>those changes will be lost</span>.
							<br />
							<br />
							<span className='font-semibold text-default-900'>Do you want to continue without saving?</span>
						</p>
					</ModalBody>
					<ModalFooter>
						<Button variant='light' onPress={navGuard.reject}>
							Cancel
						</Button>
						<Button color='danger' onPress={navGuard.accept}>
							Discard changes
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</DashboardNavbar>
	);
}
