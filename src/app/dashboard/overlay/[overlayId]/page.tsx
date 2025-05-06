"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getOverlay, saveOverlay } from "@/app/actions/database";
import { Button, Card, CardBody, CardHeader, Divider, Form, Input, Select, SelectItem, Snippet, Spinner, Switch } from "@heroui/react";
import { Overlay, OverlayType } from "@types";
import { IconDeviceFloppy, IconPlayerPauseFilled, IconPlayerPlayFilled } from "@tabler/icons-react";

const overlayTypes: { key: OverlayType; label: string }[] = [
	{ key: "1", label: "Top Clips - Today" },
	{ key: "7", label: "Top Clips - Last 7 Days" },
	{ key: "30", label: "Top Clips - Last 30 Days" },
	{ key: "90", label: "Top Clips - Last 90 Days" },
	{ key: "180", label: "Top Clips - Last 180 Days" },
	{ key: "365", label: "Top Clips - Last Year" },
	{ key: "Featured", label: "Top Clips - Featured only" },
];

export default OverlaySettings;
function OverlaySettings() {
	const { overlayId } = useParams() as { overlayId: string };

	const [overlay, setOverlay] = useState<Overlay | null>(null);
	const [baseUrl, setBaseUrl] = useState<string | null>(null);

	useEffect(() => {
		setBaseUrl(window.location.origin);
	}, []);

	useEffect(() => {
		async function fetchOverlay() {
			const fetchedOverlay = await getOverlay(overlayId);
			setOverlay(fetchedOverlay);
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

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (!overlay) return;
		await saveOverlay(overlayId, overlay);
	}

	return (
		<div className='flex flex-col items-center justify-center w-full p-4'>
			<Card className='w-full max-w-4xl'>
				<CardHeader className='justify-between'>
					<h1 className='text-xl font-bold'>Overlay Settings</h1>
					<span className='text-sm text-gray-500'>ID: {overlayId}</span>
				</CardHeader>
				<Divider />
				<CardBody>
					<div className='flex items-center'>
						<Form className='w-full' onSubmit={handleSubmit}>
							<div className='flex items-center w-full space-x-4'>
								<Switch
									isSelected={overlay.status == "paused"}
									onValueChange={(value) => {
										setOverlay({ ...overlay, status: value ? "paused" : "active" });
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
								<Button type='submit' color='primary' isIconOnly>
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
	);
}
