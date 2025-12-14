"use client";

import { validateAuth } from "@/app/actions/auth";
import { getAllOverlays } from "@/app/actions/database";
import DashboardNavbar from "@/app/components/dashboardNavbar";
import { AuthenticatedUser } from "@/app/lib/types";
import { Card, CardBody, CardHeader, Divider, Link, Select, SelectItem, Snippet, Spinner } from "@heroui/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function EmbedTool() {
	const router = useRouter();
	const [user, setUser] = useState<AuthenticatedUser>();
	const [overlays, setOverlays] = useState<{ id: string; name: string }[]>([]);
	const [overlayId, setOverlayId] = useState<string>("");
	const [baseUrl, setBaseUrl] = useState<string>("");
	const searchParams = useSearchParams();

	useEffect(() => {
		async function handleQueryParams() {
			const oid = searchParams.get("oid");
			if (oid) {
				setOverlayId(oid);
			}
		}
		handleQueryParams();
	}, [router, searchParams]);

	useEffect(() => {
		async function setup() {
			const user = await validateAuth();

			if (!user) {
				router.push("/logout");
				return;
			}

			const userOverlays = await getAllOverlays(user.id);

			if (!userOverlays || userOverlays.length === 0) return;

			setOverlays(userOverlays.map((overlay) => ({ id: overlay.id, name: overlay.name })));
		}

		setup();
	}, [router, overlayId]);

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
							>
								{overlays.map((overlay) => (
									<SelectItem key={overlay.id}>{overlay.name}</SelectItem>
								))}
							</Select>
							<div>
								<Snippet
									size='sm'
									className='w-full max-w-full'
									symbol=''
									classNames={{
										pre: "overflow-hidden whitespace-nowrap",
									}}
								>
									{overlayId === "" ? "Select an overlay to generate the link" : `${baseUrl}/embed/${overlayId}`}
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
									{overlayId === "" ? "Select an overlay to see the embed code" : `<iframe src="${baseUrl}/embed/${overlayId === "" ? "default" : overlayId}" class="w-full h-full" title="Clipify Overlay" style="width: 100%; aspect-ratio: 16 / 9; border: 0;"></iframe>`}
								</Snippet>
							</div>
						</CardBody>
					</Card>

					<Card>
						<CardHeader>
							<h2 className='text-2xl font-bold'>Preview</h2>
						</CardHeader>
						<CardBody className='flex flex-col px-5 pb-5 w-full items-center justify-center'>
							<iframe src={`${baseUrl}/embed/${overlayId === "" ? "default" : overlayId}`} className='w-full aspect-video rounded-lg' title='Overlay Preview' />
							{user && user.plan === "free" && (
								<p className='text-sm text-warning font-medium'>
									Your current plan allows you to use the embed tool with Clipify branding.{" "}
									<Link color='warning' className='text-sm' underline='always' href='/dashboard/settings'>
										Upgrade now
									</Link>{" "}
									to remove the branding.
								</p>
							)}
						</CardBody>
					</Card>
				</div>
			</DashboardNavbar>
		</>
	);
}
