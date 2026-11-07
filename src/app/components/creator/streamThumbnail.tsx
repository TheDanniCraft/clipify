"use client";
import { useState } from "react";
import { IconVideo } from "@tabler/icons-react";
export default function StreamThumbnail({ src, className = "w-24 sm:w-28" }: { src: string | null; className?: string }) {
	const [failed, setFailed] = useState<string | null>(null);
	return (
		<span className={`relative flex aspect-video shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-secondary text-muted ${className}`}>
			<IconVideo className='size-5' aria-hidden='true' />
			{src && failed !== src ? <img src={src} alt='' className='absolute inset-0 size-full object-cover' onError={() => setFailed(src)} /> : null}
		</span>
	);
}
