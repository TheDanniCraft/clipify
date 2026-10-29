import Image from "next/image";

const productImages = {
	playlist: { width: 896, height: 373, alt: "Clipify playlist editor with selected clips and saved playlist controls", caption: "An example BRB playlist", mobile: { width: 326, height: 493 } },
	overlay: { width: 641, height: 360, alt: "A Twitch highlight playing with Clipify's channel and clip information", caption: "The view on stream", mobile: null },
	theme: { width: 880, height: 520, alt: "Current Theme Studio controls for player layout, typography and colors", caption: "Theme Studio in Clipify", mobile: { width: 294, height: 490 } },
	controls: { width: 656, height: 550, alt: "Clipify remote controls showing pause, skip, mute and volume for an example clip", caption: "An example remote control panel", mobile: { width: 366, height: 630 } },
} as const;

export default function ProductImage({ view, className = "" }: { view: keyof typeof productImages; className?: string }) {
	const image = productImages[view];
	return (
		<figure className={`min-w-0 ${className}`}>
			<picture className='block overflow-hidden rounded-2xl border border-white/10 bg-[#171717] shadow-lg shadow-black/10'>
				{image.mobile && <source media='(max-width: 640px)' srcSet={`/product/${view}-mobile.webp`} width={image.mobile.width} height={image.mobile.height} />}
				<Image src={`/product/${view}.webp`} alt={image.alt} width={image.width} height={image.height} sizes='(max-width: 640px) 100vw, 720px' loading='lazy' className='h-auto w-full' />
			</picture>
			<figcaption className='mt-3 text-xs text-foreground/65'>{image.caption}</figcaption>
		</figure>
	);
}
