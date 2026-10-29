import Image from "next/image";

const productImages = {
	theme: { alt: "Theme Studio typography and background color controls with the color picker open", mobile: true },
	playlist: { alt: "Clipify playlist editor with selected clips and saved playlist controls", mobile: true },
	overlay: { alt: "Clipify overlay settings with a saved playlist and playback options", mobile: true },
	controls: { alt: "Clipify remote playback controls for pause, skip, mute and volume", mobile: true },
	selection: { alt: "Selecting Twitch highlights in Clipify's playlist editor", mobile: false },
	broadcast: { alt: "Twitch highlights playing through the Clipify player", mobile: false },
} as const;

export default function ProductImage({ view, className = "" }: { view: keyof typeof productImages; className?: string }) {
	const image = productImages[view];
	return (
		<picture className={`block min-w-0 overflow-hidden rounded-xl ${className}`}>
			{image.mobile && <source media='(max-width: 640px)' srcSet={`/product/${view}-mobile.webp 3x`} width={view === "overlay" ? 1416 : 1080} height={view === "overlay" ? 1560 : 810} />}
			<Image unoptimized src={`/product/${view}.webp`} alt={image.alt} width={view === "broadcast" ? 1664 : view === "overlay" ? 2028 : 1800} height={view === "broadcast" ? 936 : view === "overlay" ? 1512 : 1350} sizes={view === "broadcast" ? "(max-width: 1024px) 100vw, 720px" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 768px"} loading='lazy' className='h-auto w-full' />
		</picture>
	);
}
