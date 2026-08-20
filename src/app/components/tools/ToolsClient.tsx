"use client";

import { getGalleryPreview } from "@actions/gallery";
import ClipifyElementPreview from "@components/clipifyElementPreview";
import CodeSnippet from "@components/codeSnippet";
import GalleryInlinePreview from "@components/gallery/GalleryInlinePreview";
import { Button, Card, Label, Link, ListBox, Select, Separator, Switch, Tabs } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { CLIPIFY_ELEMENTS_HELP_URL } from "@lib/constants";
import { IconArrowLeft } from "@tabler/icons-react";
import type { Gallery, Overlay } from "@types";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function CopyField({ label, value, description }: { label: string; value: string; description?: string }) {
	return (
		<div className='flex flex-col gap-1.5'>
			<Label>{label}</Label>
			<CodeSnippet symbol='' className='w-full' preClassName='overflow-x-auto whitespace-pre'>
				{value}
			</CodeSnippet>
			{description ? <p className='text-xs text-muted'>{description}</p> : null}
		</div>
	);
}

function ResourceSelect({ label, value, items, onChange }: { label: string; value: string; items: { id: string; name: string }[]; onChange: (value: string) => void }) {
	return (
		<Select fullWidth variant='secondary' value={value || null} onChange={(next) => onChange(String(next ?? ""))} placeholder={`Select ${label.toLowerCase()}`}>
			<Label>{label}</Label>
			<Select.Trigger>
				<Select.Value />
				<Select.Indicator />
			</Select.Trigger>
			<Select.Popover>
				<ListBox>
					{items.map((item) => (
						<ListBox.Item key={item.id} id={item.id} textValue={item.name}>
							{item.name}
							<ListBox.ItemIndicator />
						</ListBox.Item>
					))}
				</ListBox>
			</Select.Popover>
		</Select>
	);
}

function OptionSwitch({ children, isSelected, onChange }: { children: string; isSelected: boolean; onChange: (value: boolean) => void }) {
	return (
		<Switch isSelected={isSelected} onChange={onChange}>
			<Switch.Content>
				<Switch.Control>
					<Switch.Thumb />
				</Switch.Control>
				{children}
			</Switch.Content>
		</Switch>
	);
}

export default function ToolsClient({ overlays, galleries, initialTool, initialGalleryId, origin }: { overlays: Overlay[]; galleries: Gallery[]; initialTool: "player" | "gallery"; initialGalleryId?: string; origin: string }) {
	const router = useRouter();
	const [tool, setTool] = useState<"player" | "gallery">(initialTool);
	const [overlayId, setOverlayId] = useState(overlays[0]?.id ?? "");
	const [galleryId, setGalleryId] = useState(initialGalleryId && galleries.some((item) => item.id === initialGalleryId) ? initialGalleryId : (galleries[0]?.id ?? ""));
	const [muted, setMuted] = useState(false);
	const [autoplay, setAutoplay] = useState(false);
	const [showBanner, setShowBanner] = useState(false);
	const [showOverlay, setShowOverlay] = useState(false);
	const [galleryPreview, setGalleryPreview] = useState<Awaited<ReturnType<typeof getGalleryPreview>>>(null);
	const overlay = overlays.find((item) => item.id === overlayId);
	const gallery = galleries.find((item) => item.id === galleryId);
	const playerUrl = useMemo(() => {
		const url = new URL(`/embed/${overlayId || "player-id"}`, origin);
		if (muted) url.searchParams.set("muted", "true");
		if (autoplay) url.searchParams.set("autoplay", "true");
		if (showBanner) url.searchParams.set("showBanner", "true");
		if (showOverlay) url.searchParams.set("showOverlay", "true");
		return url.href;
	}, [autoplay, muted, origin, overlayId, showBanner, showOverlay]);
	const playerElement = `<clipify-player player-id="${overlayId || "actual-player-id"}"${muted ? " muted" : ""}${autoplay ? " autoplay" : ""}${showBanner ? " show-banner" : ""}${showOverlay ? " show-overlay" : ""}></clipify-player>`;
	const playerIframe = `<iframe src="${playerUrl}" title="Clipify player" allow="autoplay" loading="lazy" referrerpolicy="strict-origin" style="width:100%;aspect-ratio:16/9;border:0"></iframe>`;
	const galleryElement = `<clipify-gallery gallery-id="${galleryId || "actual-gallery-id"}"></clipify-gallery>`;

	useEffect(() => {
		let active = true;
		if (!galleryId) return;
		void getGalleryPreview(galleryId).then((preview) => {
			if (active) setGalleryPreview(preview);
		});
		return () => {
			active = false;
		};
	}, [galleryId]);

	return (
		<div className='mx-auto w-full max-w-7xl px-6 py-8 md:px-12 lg:px-16'>
			<Tabs selectedKey={tool} onSelectionChange={(key) => setTool(key === "gallery" ? "gallery" : "player")} className='mb-6 w-fit max-w-full'>
				<Tabs.ListContainer className='w-fit max-w-full'>
					<Tabs.List aria-label='Integration tool' className='w-fit max-w-full *:w-fit'>
						<Tabs.Tab id='player' className='flex-none'>
							<Label>Clip Player</Label>
							<Tabs.Indicator />
						</Tabs.Tab>
						<Tabs.Tab id='gallery' className='flex-none'>
							<Label>Clip Gallery</Label>
							<Tabs.Indicator />
						</Tabs.Tab>
					</Tabs.List>
				</Tabs.ListContainer>
			</Tabs>

			<div className='grid grid-cols-1 items-start gap-4 md:grid-cols-2 md:gap-8'>
				<Card>
					<Card.Header>
						<div className='flex items-center gap-3'>
							<Button isIconOnly variant='tertiary' aria-label='Back to dashboard' onPress={() => router.push("/dashboard")}>
								<IconArrowLeft />
							</Button>
							<div>
								<h2 className='text-xl font-bold'>{tool === "player" ? "Configure Clip Player" : "Configure Clip Gallery"}</h2>
								<p className='text-sm text-muted'>Choose a resource and copy the installation code.</p>
							</div>
						</div>
					</Card.Header>
					<Separator />
					<Card.Content className='flex flex-col gap-5'>
						{tool === "player" ? (
							<>
								<ResourceSelect label='Player' value={overlayId} items={overlays} onChange={setOverlayId} />
								{overlay ? (
									<p className='text-sm text-muted'>
										<span className='font-semibold text-foreground'>{overlay.name}</span> · backed by your overlay configuration
									</p>
								) : (
									<p className='text-sm text-muted'>Create an overlay before installing a Clip Player.</p>
								)}
								<CopyField label='Player ID' value={overlayId} description='This ID identifies the selected Clipify player. Overlay secrets are never exposed.' />
								<div className='grid gap-3 sm:grid-cols-2'>
									<OptionSwitch isSelected={muted} onChange={setMuted}>
										Muted
									</OptionSwitch>
									<OptionSwitch isSelected={autoplay} onChange={setAutoplay}>
										Autoplay
									</OptionSwitch>
									<OptionSwitch isSelected={showBanner} onChange={setShowBanner}>
										Branding banner
									</OptionSwitch>
									<OptionSwitch isSelected={showOverlay} onChange={setShowOverlay}>
										Player display
									</OptionSwitch>
								</div>
								<CopyField label='Player URL' value={playerUrl} />
								<CopyField label='Iframe code' value={playerIframe} />
								<CopyField label='Clipify Player element' value={playerElement} />
							</>
						) : (
							<>
								<ResourceSelect label='Gallery' value={galleryId} items={galleries} onChange={setGalleryId} />
								{gallery ? (
									<p className='text-sm text-muted'>
										<span className='font-semibold text-foreground'>{gallery.name}</span> · {gallery.published ? "Published" : "Draft"} · {gallery.source === "curated" ? "Curated" : "Live"}
									</p>
								) : (
									<p className='text-sm text-muted'>Create a gallery before installing it.</p>
								)}
								<CopyField label='Gallery ID' value={galleryId} />
								<CopyField label='Clipify Gallery element' value={galleryElement} />
								<p className='text-sm text-muted'>Install Clipify Elements once, then place this element where the gallery should appear. Galleries intentionally have no raw iframe embed because the website-level clip modal must be created in the host page.</p>
							</>
						)}
					</Card.Content>
					<Card.Footer className='flex flex-wrap gap-2'>
						<Link href={CLIPIFY_ELEMENTS_HELP_URL} target='_blank' rel='noopener noreferrer' className={buttonVariants({ variant: "primary" })}>
							Install Clipify Elements
							<Link.Icon />
						</Link>
						{tool === "gallery" && galleryId ? (
							<Link href={`/dashboard/galleries/${galleryId}`} className={buttonVariants({ variant: "tertiary" })}>
								Configure gallery
							</Link>
						) : null}
					</Card.Footer>
				</Card>

				<Card>
					<Card.Header>
						<div>
							<h2 className='text-xl font-bold'>Preview</h2>
							<p className='text-sm text-muted'>{tool === "gallery" ? "Test the gallery on a realistic website canvas." : "Preview the selected player configuration."}</p>
						</div>
					</Card.Header>
					<Separator />
					<Card.Content>
						{tool === "player" && overlayId ? <ClipifyElementPreview type='player' resourceId={overlayId} /> : null}
						{tool === "gallery" && galleryPreview?.gallery.id === galleryId ? <GalleryInlinePreview gallery={galleryPreview.gallery} clips={galleryPreview.clips} ownerName={galleryPreview.ownerName} showAttribution={galleryPreview.showAttribution} /> : null}
					</Card.Content>
				</Card>
			</div>
		</div>
	);
}
