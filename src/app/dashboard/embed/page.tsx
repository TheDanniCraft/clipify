"use client";

import { validateAuth } from "@actions/auth";
import { getAccessToken, getAllOverlays, getEditorOverlays, getOverlayOwnerPlans } from "@actions/database";
import { getUsersDetailsBulk } from "@actions/twitch";
import DashboardNavbar from "@components/dashboardNavbar";
import CodeSnippet from "@components/codeSnippet";
import FullscreenLoadingState from "@components/fullscreenLoadingState";
import { AuthenticatedUser, Overlay } from "@types";
import { Avatar, Button, Card, Separator, Label, Link, ListBox, Select, Switch, Tooltip, useOverlayState } from "@heroui/react";

import { IconArrowLeft, IconCode, IconEye, IconLink, IconPlayerPlayFilled, IconSparkles, IconVolume } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import UpgradeModal from "@components/upgradeModal";
import ChatwootData from "@components/chatwootData";

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
	const [showEmbedOverlay, setShowEmbedOverlay] = useState<boolean>(false);
	const [avatars, setAvatars] = useState<Record<string, string>>({});
	const [ownerPlansByOverlayId, setOwnerPlansByOverlayId] = useState<Record<string, string>>({});
	const [isInitializing, setIsInitializing] = useState<boolean>(true);
	const [initializationError, setInitializationError] = useState<string | null>(null);
	const { isOpen: isUpgradeOpen, open: onUpgradeOpen, setOpen: onUpgradeOpenChange } = useOverlayState();

	useEffect(() => {
		async function setup() {
			try {
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
				setOverlays(uniqueOverlays);

				const token = await getAccessToken(user.id);

				if (token && uniqueOverlays.length > 0) {
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

				if (uniqueOverlays.length > 0) {
					const plansByOverlayId = await getOverlayOwnerPlans(uniqueOverlays.map((overlay) => overlay.id));
					const normalizedPlans = Object.fromEntries(uniqueOverlays.map((overlay) => [overlay.id, plansByOverlayId[overlay.id] ?? "free"]));
					setOwnerPlansByOverlayId(normalizedPlans);
				}
			} catch (error) {
				console.error("Failed to initialize embed tool:", error);
				setInitializationError("We couldn't load the embed tool. Please retry.");
			} finally {
				setIsInitializing(false);
			}
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
		if (showEmbedOverlay) params.push("showOverlay");
		if (embedMuted) params.push("muted");
		if (embedAutoplay) params.push("autoplay");
		const query = params.join("&");
		return `${baseUrl}/embed/${id}${query ? `?${query}` : ""}`;
	};

	if (isInitializing) return <FullscreenLoadingState message='Loading embed tool...' />;

	if (initializationError) {
		return (
			<div className='flex flex-col items-center justify-center w-full h-screen gap-4 px-6 text-center'>
				<p className='text-danger text-sm'>{initializationError}</p>
				<div className='flex items-center gap-2'>
					<Button onPress={() => window.location.reload()} variant='primary'>
						Retry
					</Button>
					<Button variant='tertiary' onPress={() => router.push("/logout")}>
						Log out
					</Button>
				</div>
			</div>
		);
	}

	if (overlays.length === 0) {
		if (!user) {
			return <FullscreenLoadingState message='Loading embed tool...' />;
		}
		return (
			<DashboardNavbar user={user} title='Embed Widget Tool' tagline='Generate embed codes for your overlays'>
				<div className='mx-auto max-w-xl w-full px-6 py-12'>
					<Card>
						<Card.Content className='flex flex-col gap-4'>
							<p className='text-foreground'>Create your first overlay to unlock the embed tool.</p>
							<Button onPress={() => router.push("/dashboard")} variant='primary'>
								Create first overlay
							</Button>
						</Card.Content>
					</Card>
				</div>
			</DashboardNavbar>
		);
	}

	return (
		<>
			<ChatwootData user={user} overlay={overlays.find((o) => o.id === overlayId)} />

			<DashboardNavbar user={user!} title='Embed Widget Tool' tagline='Generate embed codes for your overlays'>
				<div className='px-6 md:px-12 lg:px-16 py-8 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 items-start max-w-7xl mx-auto w-full'>
					<Card>
						<Card.Header>
							<div className='flex items-center gap-2'>
								<Button isIconOnly variant='tertiary' onPress={() => router.push("/dashboard")} aria-label='Back to Dashboard'>
									{<IconArrowLeft />}
								</Button>
								<h2 className='text-2xl font-bold flex items-center gap-2'>Select Overlay</h2>
							</div>
						</Card.Header>
						<Card.Content className='flex flex-col gap-4'>
							<Select
								variant='secondary'
								value={overlayId || null}
								onChange={(selected) => {
									const nextId = String(selected ?? "");
									setOverlayId(nextId);
									const nextPlan = nextId ? ownerPlansByOverlayId[nextId] : undefined;
									if (!nextId || nextPlan !== "free") {
										setShowBanner(false);
									}
								}}
								placeholder='Select an overlay to generate embed code'
							>
								<Label>Select Overlay</Label>
								<Select.Trigger>
									<Select.Value />
									<Select.Indicator />
								</Select.Trigger>
								<Select.Popover>
									<ListBox>
										{overlays.map((overlay) => (
											<ListBox.Item key={overlay.id} id={overlay.id} textValue={overlay.name}>
												<Label className='flex items-center'>
													<Avatar className='mr-2 h-6 w-6'>
														<Avatar.Image alt='' src={avatars[overlay.ownerId]} />
														<Avatar.Fallback>?</Avatar.Fallback>
													</Avatar>
													{overlay.name}
												</Label>
												<ListBox.ItemIndicator />
											</ListBox.Item>
										))}
									</ListBox>
								</Select.Popover>
							</Select>
							<Tooltip delay={0}>
								<Tooltip.Trigger>
									<span>
										<Switch size='lg' isSelected={effectiveShowBanner} onChange={setShowBanner} isDisabled={!overlayId || ownerPlan === "free"}>
											<Switch.Content>
												<Switch.Control>
													<Switch.Thumb />
												</Switch.Control>
												<span className='flex items-center gap-2'>
													<IconSparkles className='h-4 w-4 text-accent' />
													Enable Clipify Branding
												</span>
											</Switch.Content>
										</Switch>
									</span>
								</Tooltip.Trigger>
								<Tooltip.Content>{ownerPlan === "free" ? "This overlay's owner must upgrade to remove Clipify branding" : "Toggle to include Clipify branding on your overlay"}</Tooltip.Content>
							</Tooltip>
							{ownerPlan === "free" && (
								<Button variant='primary' onPress={onUpgradeOpen} className='text-white'>
									Upgrade to remove branding
								</Button>
							)}
							<Tooltip delay={0}>
								<Tooltip.Trigger>
									<span>
										<Switch size='lg' isSelected={embedAutoplay} onChange={setEmbedAutoplay} isDisabled={!overlayId}>
											<Switch.Content>
												<Switch.Control>
													<Switch.Thumb />
												</Switch.Control>
												<span className='flex items-center gap-2'>
													<IconPlayerPlayFilled className='h-4 w-4 text-emerald-500' />
													Autoplay (skip click-to-play)
												</span>
											</Switch.Content>
										</Switch>
									</span>
								</Tooltip.Trigger>
								<Tooltip.Content>Toggle autoplay for this embed</Tooltip.Content>
							</Tooltip>
							<Tooltip delay={0}>
								<Tooltip.Trigger>
									<span>
										<Switch size='lg' isSelected={showEmbedOverlay} onChange={setShowEmbedOverlay} isDisabled={!overlayId}>
											<Switch.Content>
												<Switch.Control>
													<Switch.Thumb />
												</Switch.Control>
												<span className='flex items-center gap-2'>
													<IconEye className='h-4 w-4 text-purple-500' />
													Show clip overlay
												</span>
											</Switch.Content>
										</Switch>
									</span>
								</Tooltip.Trigger>
								<Tooltip.Content>Show clip title, creator and game overlay on the embed</Tooltip.Content>
							</Tooltip>
							<Tooltip delay={0}>
								<Tooltip.Trigger>
									<span>
										<Switch size='lg' isSelected={embedMuted} onChange={setEmbedMuted} isDisabled={!overlayId}>
											<Switch.Content>
												<Switch.Control>
													<Switch.Thumb />
												</Switch.Control>
												<span className='flex items-center gap-2'>
													<IconVolume className='h-4 w-4 text-blue-500' />
													Start muted
												</span>
											</Switch.Content>
										</Switch>
									</span>
								</Tooltip.Trigger>
								<Tooltip.Content>Toggle starting muted for this embed</Tooltip.Content>
							</Tooltip>
							<div>
								<div className='text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2 flex items-center gap-2'>
									<IconLink className='h-4 w-4' />
									Embed link
								</div>
								<CodeSnippet size='sm' className='w-full max-w-full' symbol='' preClassName='overflow-hidden whitespace-nowrap'>
									{overlayId === "" ? "Select an overlay to generate the link" : buildEmbedUrl(overlayId)}
								</CodeSnippet>
								<p className='text-sm text-gray-500'>You can use this link to embed your overlay (e.g. iframe)</p>
							</div>
							<Separator />
							<div>
								<div className='text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2 flex items-center gap-2'>
									<IconCode className='h-4 w-4' />
									Embed code
								</div>
								<CodeSnippet className='w-full max-w-full' symbol='' preClassName='overflow-hidden whitespace-nowrap'>
									{overlayId === "" ? "Select an overlay to see the embed code" : `<iframe src="${buildEmbedUrl(overlayId === "" ? "default" : overlayId)}" class="w-full h-full" title="Clipify Overlay" style="width: 100%; aspect-ratio: 16 / 9; border: 0;"></iframe>`}
								</CodeSnippet>
							</div>
						</Card.Content>
					</Card>

					<Card>
						<Card.Header>
							<h2 className='text-2xl font-bold flex items-center gap-2'>
								<IconEye className='h-5 w-5 text-accent' />
								Preview
							</h2>
						</Card.Header>
						<Card.Content className='flex flex-col px-5 pb-5 w-full items-center justify-center'>
							<iframe referrerPolicy='strict-origin-when-cross-origin' src={buildEmbedUrl(overlayId === "" ? "default" : overlayId)} className='w-full aspect-video rounded-lg' title='Overlay Preview' />
							{ownerPlan === "free" && (
								<p className='text-sm text-warning font-medium mt-2'>
									Your current plan allows you to use the embed tool with Clipify branding.{" "}
									<Link className='text-sm text-warning underline underline-offset-2' href='/dashboard/settings'>
										Upgrade now
									</Link>{" "}
									to remove the branding.
								</p>
							)}

							{ownerPlan !== "free" && effectiveShowBanner && <p className='text-sm text-success font-medium mt-2'>You enabled Clipify branding for this embed. Thanks for supporting Clipify!</p>}
						</Card.Content>
					</Card>
				</div>
			</DashboardNavbar>
			{user && <UpgradeModal isOpen={isUpgradeOpen} onOpenChange={onUpgradeOpenChange} user={user} title='Remove branding with Pro' />}
		</>
	);
}
