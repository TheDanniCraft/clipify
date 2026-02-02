"use client";

import { validateAuth } from "@/app/actions/auth";
import { getAccessToken, getAllOverlays, getEditorOverlays, getOverlayOwnerPlans } from "@/app/actions/database";
import { getUsersDetailsBulk } from "@/app/actions/twitch";
import DashboardNavbar from "@/app/components/dashboardNavbar";
import { AuthenticatedUser, Overlay } from "@/app/lib/types";
import { Avatar, Button, Card, CardBody, CardHeader, Divider, Link, Select, SelectItem, Snippet, Spinner, Switch, Tooltip, useDisclosure } from "@heroui/react";
import { IconArrowLeft, IconCode, IconEye, IconLink, IconPlayerPlayFilled, IconSparkles, IconVolume } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import UpgradeModal from "@/app/components/upgradeModal";

export default function EmbedTool() {
	const router = useRouter();
	const [user, setUser] = useState<AuthenticatedUser>();
	const [overlays, setOverlays] = useState<Overlay[]>([]);
	const [overlayId, setOverlayId] = useState<string>(() => {
		if (typeof window === "undefined") return "";
		return new URLSearchParams(window.location.search).get("oid") ?? "";
	});
	const [baseUrl, setBaseUrl] = useState<string>("");
	const [showBanner, setShowBanner] = useState<boolean>(false);
	const [embedMuted, setEmbedMuted] = useState<boolean>(false);
	const [embedAutoplay, setEmbedAutoplay] = useState<boolean>(false);
	const [avatars, setAvatars] = useState<Record<string, string>>({});
	const [ownerPlansByOverlayId, setOwnerPlansByOverlayId] = useState<Record<string, string>>({});
	const { isOpen: isUpgradeOpen, onOpen: onUpgradeOpen, onOpenChange: onUpgradeOpenChange } = useDisclosure();

	useEffect(() => {
		async function setup() {
			const user = await validateAuth();

			if (!user) {
				router.push("/logout");
				return;
			}

			setUser(user);

			const userOverlays = (await getAllOverlays(user.id)) || [];
			const editorOverlays = (await getEditorOverlays(user.id)) || [];
			const combined = [...userOverlays, ...editorOverlays];
			const uniqueOverlays = Array.from(new Map(combined.map((overlay) => [overlay.id, overlay])).values());

			const token = await getAccessToken(user.id);

			if (token) {
				const avatars = await getUsersDetailsBulk({ userIds: uniqueOverlays.map((o) => o.ownerId), accessToken: token?.accessToken });
				setAvatars(
					avatars.reduce(
						(acc, curr) => {
							acc[curr.id] = curr.profile_image_url;
							return acc;
						},
						{} as Record<string, string>,
					),
				);
			}

			if (uniqueOverlays.length === 0) return;

			setOverlays(uniqueOverlays);

			const plansByOverlayId = await getOverlayOwnerPlans(uniqueOverlays.map((overlay) => overlay.id));
			const normalizedPlans = Object.fromEntries(uniqueOverlays.map((overlay) => [overlay.id, plansByOverlayId[overlay.id] ?? "free"]));
			setOwnerPlansByOverlayId(normalizedPlans);
		}

		setup();
	}, [router]);

	useEffect(() => {
		function fetchBaseUrl() {
			if (typeof window !== "undefined" && window.location && window.location.origin) {
				setBaseUrl(window.location.origin);
			} else {
				setBaseUrl("");
			}
		}

		fetchBaseUrl();
	}, []);

	const ownerPlan = overlayId ? ownerPlansByOverlayId[overlayId] : undefined;
	const effectiveShowBanner = ownerPlan === "free" ? true : !!showBanner;

	const buildEmbedUrl = (id: string) => {
		if (!id) return "";
		const params: string[] = [];
		if (effectiveShowBanner) params.push("showBanner");
		if (embedMuted) params.push("muted");
		if (embedAutoplay) params.push("autoplay");
		const query = params.join("&");
		return `${baseUrl}/embed/${id}${query ? `?${query}` : ""}`;
	};

	if (overlays.length === 0)
		return (
			<div className='flex flex-col items-center justify-center w-full h-screen'>
				<Spinner label='Loading embed tool...' />
			</div>
		);

	return (
		<>
			<script src='//tag.goadopt.io/injector.js?website_code=792b9b29-57f9-4d92-b5f1-313f94ddfacc' className='adopt-injector' defer></script>

			<DashboardNavbar user={user!} title='Embed Widget Tool' tagline='Generate embed codes for your overlays'>
				<div className='px-6 md:px-12 lg:px-16 py-8 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 items-start max-w-7xl mx-auto w-full'>
					<Card>
						<CardHeader>
							<div className='flex items-center gap-2'>
								<Button isIconOnly variant='light' startContent={<IconArrowLeft />} onPress={() => router.push("/dashboard")} aria-label='Back to Dashboard' />
								<h2 className='text-2xl font-bold flex items-center gap-2'>Select Overlay</h2>
							</div>
						</CardHeader>
						<CardBody className='flex flex-col gap-4'>
							<Select
								selectedKeys={overlayId === "" ? new Set([]) : new Set([overlayId])}
								onSelectionChange={(selected) => {
									const nextId = String(Array.from(selected)[0] ?? "");
									setOverlayId(nextId);
									const nextPlan = nextId ? ownerPlansByOverlayId[nextId] : undefined;
									if (!nextId || nextPlan !== "free") {
										setShowBanner(false);
									}
								}}
								label='Select Overlay'
								placeholder='Select an overlay to generate embed code'
								renderValue={() => {
									const selected = overlayId;
									const found = overlays.find((o) => o.id === selected);
									return found ? found.name : undefined;
								}}
							>
								{overlays.map((overlay) => (
									<SelectItem key={overlay.id}>
										<div className='flex items-center'>
											<Avatar className='mr-2 h-6 w-6' src={avatars[overlay.ownerId]} />
											{overlay.name}
										</div>
									</SelectItem>
								))}
							</Select>
							<Tooltip content={ownerPlan === "free" ? "This overlay's owner must upgrade to remove Clipify branding" : "Toggle to include Clipify branding on your overlay"}>
								<span>
									<Switch isSelected={effectiveShowBanner} onValueChange={setShowBanner} isDisabled={!overlayId || ownerPlan === "free"}>
										<span className='flex items-center gap-2'>
											<IconSparkles className='h-4 w-4 text-primary' />
											Enable Clipify Branding
										</span>
									</Switch>
								</span>
							</Tooltip>
							{ownerPlan === "free" && (
								<Button variant='solid' color='primary' onPress={onUpgradeOpen} className='text-white'>
									Upgrade to remove branding
								</Button>
							)}
							<Tooltip content='Toggle autoplay for this embed'>
								<span>
									<Switch isSelected={embedAutoplay} onValueChange={setEmbedAutoplay} isDisabled={!overlayId}>
										<span className='flex items-center gap-2'>
											<IconPlayerPlayFilled className='h-4 w-4 text-emerald-500' />
											Autoplay (skip click-to-play)
										</span>
									</Switch>
								</span>
							</Tooltip>
							<Tooltip content='Toggle starting muted for this embed'>
								<span>
									<Switch isSelected={embedMuted} onValueChange={setEmbedMuted} isDisabled={!overlayId}>
										<span className='flex items-center gap-2'>
											<IconVolume className='h-4 w-4 text-blue-500' />
											Start muted
										</span>
									</Switch>
								</span>
							</Tooltip>
							<div>
								<div className='text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2 flex items-center gap-2'>
									<IconLink className='h-4 w-4' />
									Embed link
								</div>
								<Snippet
									size='sm'
									className='w-full max-w-full'
									symbol=''
									classNames={{
										pre: "overflow-hidden whitespace-nowrap",
									}}
								>
									{overlayId === "" ? "Select an overlay to generate the link" : buildEmbedUrl(overlayId)}
								</Snippet>
								<p className='text-sm text-gray-500'>You can use this link to embed your overlay (e.g. iframe)</p>
							</div>
							<Divider />
							<div>
								<div className='text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2 flex items-center gap-2'>
									<IconCode className='h-4 w-4' />
									Embed code
								</div>
								<Snippet
									className='w-full max-w-full'
									symbol=''
									classNames={{
										pre: "overflow-hidden whitespace-nowrap",
									}}
								>
									{overlayId === "" ? "Select an overlay to see the embed code" : `<iframe src="${buildEmbedUrl(overlayId === "" ? "default" : overlayId)}" class="w-full h-full" title="Clipify Overlay" style="width: 100%; aspect-ratio: 16 / 9; border: 0;"></iframe>`}
								</Snippet>
							</div>
						</CardBody>
					</Card>

					<Card>
						<CardHeader>
							<h2 className='text-2xl font-bold flex items-center gap-2'>
								<IconEye className='h-5 w-5 text-primary' />
								Preview
							</h2>
						</CardHeader>
						<CardBody className='flex flex-col px-5 pb-5 w-full items-center justify-center'>
							<iframe referrerPolicy='strict-origin-when-cross-origin' src={buildEmbedUrl(overlayId === "" ? "default" : overlayId)} className='w-full aspect-video rounded-lg' title='Overlay Preview' />
							{ownerPlan === "free" && (
								<p className='text-sm text-warning font-medium mt-2'>
									Your current plan allows you to use the embed tool with Clipify branding.{" "}
									<Link color='warning' className='text-sm' underline='always' href='/dashboard/settings'>
										Upgrade now
									</Link>{" "}
									to remove the branding.
								</p>
							)}

							{ownerPlan !== "free" && effectiveShowBanner && <p className='text-sm text-success font-medium mt-2'>You enabled Clipify branding for this embed. Thanks for supporting Clipify!</p>}
						</CardBody>
					</Card>
				</div>
			</DashboardNavbar>
			{user && <UpgradeModal isOpen={isUpgradeOpen} onOpenChange={onUpgradeOpenChange} user={user} title='Remove branding with Pro' />}
		</>
	);
}
