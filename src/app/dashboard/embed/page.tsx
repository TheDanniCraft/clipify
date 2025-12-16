"use client";

import { validateAuth } from "@/app/actions/auth";
import { getAccessToken, getAllOverlays, getEditorOverlays } from "@/app/actions/database";
import { getUsersDetailsBulk } from "@/app/actions/twitch";
import DashboardNavbar from "@/app/components/dashboardNavbar";
import { AuthenticatedUser, Overlay } from "@/app/lib/types";
import { Avatar, Card, CardBody, CardHeader, Divider, Link, Select, SelectItem, Snippet, Spinner, Switch, Tooltip } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function EmbedTool() {
	const router = useRouter();
	const [user, setUser] = useState<AuthenticatedUser>();
	const [overlays, setOverlays] = useState<Overlay[]>([]);
	const [overlayId, setOverlayId] = useState<string>(() => {
		if (typeof window === "undefined") return "";
		return new URLSearchParams(window.location.search).get("oid") ?? "";
	});
	const [baseUrl, setBaseUrl] = useState<string>("");
	const [showBanner, setShowBanner] = useState<boolean>();
	const [avatars, setAvatars] = useState<Record<string, string>>({});

	useEffect(() => {
		async function setup() {
			const user = await validateAuth();

			if (!user) {
				router.push("/logout");
				return;
			}

			setUser(user);

			const userOverlays = (await getAllOverlays(user.id)) || [];
			const editorOverlays = await getEditorOverlays(user.id);

			if (editorOverlays && editorOverlays.length > 0) {
				for (const editor of editorOverlays) {
					const editorOwnerOverlays = (await getAllOverlays(editor.ownerId)) || [];
					if (editorOwnerOverlays.length > 0) userOverlays.push(...editorOwnerOverlays);
				}
			}

			const token = await getAccessToken(user.id);

			if (token) {
				const avatars = await getUsersDetailsBulk({ userIds: userOverlays.map((o) => o.ownerId), accessToken: token?.accessToken });
				setAvatars(
					avatars.reduce((acc, curr) => {
						acc[curr.id] = curr.profile_image_url;
						return acc;
					}, {} as Record<string, string>)
				);
			}

			if (!userOverlays || userOverlays.length === 0) return;

			setOverlays(userOverlays);
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

	useEffect(() => {
		function initializeShowBanner() {
			if (user) {
				setShowBanner(user.plan === "free");
			}
		}

		initializeShowBanner();
	}, [user]);

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
							<h2 className='text-2xl font-bold'>Select Overlay</h2>
						</CardHeader>
						<CardBody className='flex flex-col gap-4'>
							<Select
								selectedKeys={overlayId === "" ? new Set([]) : new Set([overlayId])}
								onSelectionChange={(selected) => {
									setOverlayId(String(Array.from(selected)[0] ?? ""));
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
							<Tooltip content={user?.plan === "free" ? "Upgrade your plan to remove Clipify branding" : "Toggle to include Clipify branding on your overlay"}>
								<span>
									<Switch isSelected={showBanner} onValueChange={setShowBanner} isDisabled={user?.plan === "free"}>
										Enable Clipify Branding
									</Switch>
								</span>
							</Tooltip>
							<div>
								<Snippet
									size='sm'
									className='w-full max-w-full'
									symbol=''
									classNames={{
										pre: "overflow-hidden whitespace-nowrap",
									}}
								>
									{overlayId === "" ? "Select an overlay to generate the link" : `${baseUrl}/embed/${overlayId}${showBanner ? "?showBanner" : ""}`}
								</Snippet>
								<p className='text-sm text-gray-500'>You can use this link to embed your overlay (e.g. iframe)</p>
							</div>
							<Divider />
							<div>
								<Snippet
									className='w-full max-w-full'
									symbol=''
									classNames={{
										pre: "overflow-hidden whitespace-nowrap",
									}}
								>
									{overlayId === "" ? "Select an overlay to see the embed code" : `<iframe src="${baseUrl}/embed/${overlayId === "" ? "default" : overlayId}${showBanner ? "?showBanner" : ""}" class="w-full h-full" title="Clipify Overlay" style="width: 100%; aspect-ratio: 16 / 9; border: 0;"></iframe>`}
								</Snippet>
							</div>
						</CardBody>
					</Card>

					<Card>
						<CardHeader>
							<h2 className='text-2xl font-bold'>Preview</h2>
						</CardHeader>
						<CardBody className='flex flex-col px-5 pb-5 w-full items-center justify-center'>
							<iframe src={`${baseUrl}/embed/${overlayId === "" ? "default" : overlayId}${showBanner ? "?showBanner" : ""}`} className='w-full aspect-video rounded-lg' title='Overlay Preview' />
							{user && user.plan === "free" && (
								<p className='text-sm text-warning font-medium mt-2'>
									Your current plan allows you to use the embed tool with Clipify branding.{" "}
									<Link color='warning' className='text-sm' underline='always' href='/dashboard/settings'>
										Upgrade now
									</Link>{" "}
									to remove the branding.
								</p>
							)}

							{user && user.plan !== "free" && showBanner && <p className='text-sm text-success font-medium mt-2'>You enabled Clipify branding for this embed. Thanks for supporting Clipify!</p>}
						</CardBody>
					</Card>
				</div>
			</DashboardNavbar>
		</>
	);
}
