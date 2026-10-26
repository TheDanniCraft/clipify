"use client";
import { DropZone } from "@heroui-pro/react";
import { Button } from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { IconUpload, IconX } from "@tabler/icons-react";

export default function ImageDropZone({ label, disabled, onSelect, imageUrl, onRemove }: { label: string; disabled: boolean; onSelect: (file: File | undefined) => void; imageUrl?: string; onRemove?: () => void }) {
	return (
		<DropZone className='relative h-full'>
			{imageUrl && onRemove && (
				<Button aria-label={`Remove ${label.replace(/^Standby /, "").toLowerCase()}`} isIconOnly size='sm' variant='secondary' className='absolute right-2 top-2 z-10' isDisabled={disabled} onPress={onRemove}>
					<IconX size={16} aria-hidden='true' />
				</Button>
			)}
			<DropZone.Area
				aria-label={`Upload ${label}`}
				isDisabled={disabled}
				className='h-full min-h-48 gap-2 rounded-xl bg-surface-secondary p-4'
				onDrop={async (event) => {
					const item = event.items.find((item) => item.kind === "file");
					if (item?.kind === "file") onSelect(await item.getFile());
				}}
			>
				{imageUrl ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img src={imageUrl} alt={label} className='h-20 w-full object-contain' />
				) : (
					<DropZone.Icon>
						<IconUpload aria-hidden='true' size={24} />
					</DropZone.Icon>
				)}
				<DropZone.Label>{label}</DropZone.Label>
				{!imageUrl && <DropZone.Description>PNG, JPEG or WebP, up to 2 MiB</DropZone.Description>}
				<DropZone.Trigger isDisabled={disabled} className={buttonVariants({ variant: "secondary", size: "sm" })}>
					{imageUrl ? "Replace image" : "Choose image"}
				</DropZone.Trigger>
				<DropZone.Input aria-label={label} accept='image/png,image/jpeg,image/webp' disabled={disabled} onSelect={(files) => onSelect(files[0])} />
			</DropZone.Area>
		</DropZone>
	);
}
