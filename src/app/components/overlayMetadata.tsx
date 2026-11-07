"use client";
import { Avatar } from "@heroui/react";
import { overlayMetadataContent } from "@lib/overlayMetadata";
export function OverlayChannelMetadata({ name, avatar, category, mirrored = false }: { name: string; avatar?: string; category?: string | null; mirrored?: boolean }) {
	const content = overlayMetadataContent("channel", { title: "", broadcasterName: name, categoryName: category });
	return (
		<div className={`flex items-center ${mirrored ? "flex-row-reverse" : ""}`}>
			<Avatar size='md'>
				<Avatar.Image alt={name} src={avatar} />
				<Avatar.Fallback>{name.slice(0, 2).toUpperCase()}</Avatar.Fallback>
			</Avatar>
			<div className={`flex min-w-0 flex-col justify-center text-xs ${mirrored ? "mr-2 items-end text-right" : "ml-2 items-start text-left"}`}>
				<span className='font-semibold'>{content.primary}</span>
				<span className='text-xs opacity-80'>{content.secondary}</span>
			</div>
		</div>
	);
}
export function OverlayClipMetadata({ title, clipper, alignRight = false }: { title: string; clipper?: string | null; alignRight?: boolean }) {
	const content = overlayMetadataContent("title", { title, clipCreatorName: clipper });
	return (
		<div className={`flex flex-col break-normal ${alignRight ? "items-end text-right" : "items-start text-left"}`}>
			<span className='font-bold'>{content.primary}</span>
			<span className='mt-1 text-xs opacity-80'>{content.secondary}</span>
		</div>
	);
}
