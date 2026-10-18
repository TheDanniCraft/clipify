"use client";
import { DropZone } from "@heroui-pro/react";
import { buttonVariants } from "@heroui/styles";
import { IconUpload } from "@tabler/icons-react";

export default function ImageDropZone({ label, disabled, onSelect }: { label: string; disabled: boolean; onSelect: (file: File | undefined) => void }) {
	return (
		<DropZone className='h-full'>
			<DropZone.Area
				aria-label={`Upload ${label}`}
				isDisabled={disabled}
				className='h-full min-h-48 gap-2 rounded-xl bg-surface-secondary p-4'
				onDrop={async (event) => {
					const item = event.items.find((item) => item.kind === "file");
					if (item?.kind === "file") onSelect(await item.getFile());
				}}
			>
				<DropZone.Icon>
					<IconUpload aria-hidden='true' size={24} />
				</DropZone.Icon>
				<DropZone.Label>{label}</DropZone.Label>
				<DropZone.Description>PNG, JPEG or WebP, up to 2 MiB</DropZone.Description>
				<DropZone.Trigger isDisabled={disabled} className={buttonVariants({ variant: "secondary", size: "sm" })}>
					Choose image
				</DropZone.Trigger>
				<DropZone.Input aria-label={label} accept='image/png,image/jpeg,image/webp' disabled={disabled} onSelect={(files) => onSelect(files[0])} />
			</DropZone.Area>
		</DropZone>
	);
}
